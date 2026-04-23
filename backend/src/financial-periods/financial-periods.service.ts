import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DocumentStatus,
  FinanceAccountTransactionType,
  FinanceSettlementType,
  FinanceStatementLineStatus,
  FinancialPeriodStatus,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  buildFinancialPeriodBounds,
  canOverrideFinancialPeriod,
  formatFinancialPeriodLabel,
  getFinancialPeriodKey,
  isFinancialPeriodLocked,
  normalizeFinancialDate,
} from '../common/utils/financial-periods';
import {
  calculateOutstandingAmount,
  resolveDueState,
  resolvePaymentStatus,
} from '../common/utils/payments';
import { round2 } from '../common/utils/money';
import { PrismaService } from '../prisma/prisma.service';
import { ListFinancialPeriodsQueryDto } from './dto/list-financial-periods-query.dto';
import { UpdateFinancialPeriodStatusDto } from './dto/update-financial-period-status.dto';

const RECEIVABLE_STATUSES = [
  DocumentStatus.POSTED,
  DocumentStatus.PARTIALLY_RETURNED,
  DocumentStatus.FULLY_RETURNED,
];

type PeriodClient = Prisma.TransactionClient | PrismaService;

function startOfTodayUtc(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function endOfTodayUtc(value: Date) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 23, 59, 59, 999),
  );
}

function isInboundTransaction(type: FinanceAccountTransactionType) {
  return (
    type === FinanceAccountTransactionType.OPENING ||
    type === FinanceAccountTransactionType.MANUAL_IN ||
    type === FinanceAccountTransactionType.TRANSFER_IN ||
    type === FinanceAccountTransactionType.RECEIPT
  );
}

function duePriority(dueState?: string | null) {
  switch (dueState) {
    case 'OVERDUE':
      return 0;
    case 'DUE_TODAY':
      return 1;
    case 'CURRENT':
      return 2;
    case 'NO_DUE_DATE':
      return 3;
    case 'PAID':
      return 4;
    default:
      return 5;
  }
}

@Injectable()
export class FinancialPeriodsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  private getClient(tx?: Prisma.TransactionClient) {
    return tx ?? this.prisma;
  }

  private mapUser(
    row?:
      | {
          id: string;
          fullName: string;
          email: string | null;
        }
      | null
      | undefined,
  ) {
    if (!row) return null;
    return {
      id: row.id,
      fullName: row.fullName,
      email: row.email ?? null,
    };
  }

  private mapPeriod(
    row: {
      id: string;
      year: number;
      month: number;
      periodStart: Date;
      periodEnd: Date;
      status: FinancialPeriodStatus;
      closedAt: Date | null;
      closedReason: string | null;
      reopenedAt: Date | null;
      reopenedReason: string | null;
      createdAt: Date;
      updatedAt: Date;
      closedBy?: { id: string; fullName: string; email: string | null } | null;
      reopenedBy?: { id: string; fullName: string; email: string | null } | null;
    },
  ) {
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth() + 1;

    return {
      id: row.id,
      key: getFinancialPeriodKey(row.year, row.month),
      label: formatFinancialPeriodLabel(row.year, row.month),
      year: row.year,
      month: row.month,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      status: row.status,
      isCurrentMonth: row.year === currentYear && row.month === currentMonth,
      closedAt: row.closedAt,
      closedReason: row.closedReason ?? null,
      reopenedAt: row.reopenedAt,
      reopenedReason: row.reopenedReason ?? null,
      closedBy: this.mapUser(row.closedBy),
      reopenedBy: this.mapUser(row.reopenedBy),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async resolveUserRole(userId: string, tx?: Prisma.TransactionClient) {
    const client = this.getClient(tx);
    const user = await client.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user?.role?.code) {
      throw new BadRequestException('Current user not found for financial period validation');
    }

    return user.role.code;
  }

  async ensureYearPeriods(year: number, tx?: Prisma.TransactionClient) {
    const client = this.getClient(tx);
    const existing = await client.financialPeriod.findMany({
      where: { year },
      select: { month: true },
    });
    const existingMonths = new Set(existing.map((row) => row.month));
    const missingRows = Array.from({ length: 12 }, (_, index) => index + 1)
      .filter((month) => !existingMonths.has(month))
      .map((month) => {
        const { periodStart, periodEnd } = buildFinancialPeriodBounds(year, month);
        return {
          year,
          month,
          periodStart,
          periodEnd,
          status: FinancialPeriodStatus.OPEN,
        };
      });

    if (missingRows.length > 0) {
      await client.financialPeriod.createMany({
        data: missingRows,
      });
    }

    return client.financialPeriod.findMany({
      where: { year },
      include: {
        closedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        reopenedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { month: 'asc' },
    });
  }

  async findAll(query: ListFinancialPeriodsQueryDto = {}) {
    const year = query.year ?? new Date().getUTCFullYear();
    const rows = await this.ensureYearPeriods(year);
    const filtered = query.status ? rows.filter((row) => row.status === query.status) : rows;
    const now = new Date();
    const currentPeriod = rows.find(
      (row) => row.year === now.getUTCFullYear() && row.month === now.getUTCMonth() + 1,
    );

    return {
      year,
      items: filtered.map((row) => this.mapPeriod(row)),
      currentPeriodId: currentPeriod?.id ?? null,
      summary: {
        count: filtered.length,
        openCount: filtered.filter((row) => row.status === FinancialPeriodStatus.OPEN).length,
        softClosedCount: filtered.filter((row) => row.status === FinancialPeriodStatus.SOFT_CLOSED)
          .length,
        closedCount: filtered.filter((row) => row.status === FinancialPeriodStatus.CLOSED).length,
      },
    };
  }

  async generateYear(year: number, userId: string) {
    const rows = await this.ensureYearPeriods(year);

    await this.auditLogs.log({
      userId,
      entityType: 'financial_periods',
      entityId: rows[0]?.id ?? '00000000-0000-0000-0000-000000000000',
      action: 'GENERATE_YEAR',
      metadata: {
        year,
        count: rows.length,
      },
    });

    return {
      year,
      count: rows.length,
      items: rows.map((row) => this.mapPeriod(row)),
    };
  }

  async updateStatus(id: string, dto: UpdateFinancialPeriodStatusDto, userId: string) {
    const existing = await this.prisma.financialPeriod.findUnique({
      where: { id },
      include: {
        closedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        reopenedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Financial period not found');
    }

    const reason = dto.reason?.trim() || null;
    const changedAt = new Date();
    const nextStatus = dto.status;

    const updated = await this.prisma.financialPeriod.update({
      where: { id },
      data: {
        status: nextStatus,
        ...(nextStatus === FinancialPeriodStatus.OPEN
          ? {
              reopenedAt: changedAt,
              reopenedById: userId,
              reopenedReason: reason,
            }
          : {
              closedAt: changedAt,
              closedById: userId,
              closedReason: reason,
            }),
      },
      include: {
        closedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        reopenedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    await this.auditLogs.log({
      userId,
      entityType: 'financial_periods',
      entityId: updated.id,
      action:
        nextStatus === FinancialPeriodStatus.OPEN
          ? 'REOPEN_PERIOD'
          : nextStatus === FinancialPeriodStatus.SOFT_CLOSED
            ? 'SOFT_CLOSE_PERIOD'
            : 'CLOSE_PERIOD',
      metadata: {
        year: updated.year,
        month: updated.month,
        periodKey: getFinancialPeriodKey(updated.year, updated.month),
        statusBefore: existing.status,
        statusAfter: nextStatus,
        reason,
      },
    });

    return this.mapPeriod(updated);
  }

  async assertDateOpen(
    value: string | Date,
    userId: string,
    operationLabel: string,
    tx?: Prisma.TransactionClient,
  ) {
    const date = normalizeFinancialDate(value);
    const client = this.getClient(tx);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    await this.ensureYearPeriods(year, tx);

    const period = await client.financialPeriod.findUnique({
      where: {
        year_month: {
          year,
          month,
        },
      },
    });

    if (!period) {
      return null;
    }

    const role = await this.resolveUserRole(userId, tx);

    if (isFinancialPeriodLocked(period.status, role)) {
      throw new BadRequestException(
        `${operationLabel} nuk lejohet sepse periudha ${formatFinancialPeriodLabel(
          period.year,
          period.month,
        )} eshte ${period.status}. Vetem ADMIN mund te beje ndryshime ne periudha te mbyllura.`,
      );
    }

    return {
      period,
      adminOverride: period.status !== FinancialPeriodStatus.OPEN && canOverrideFinancialPeriod(role),
    };
  }

  async getSummary(id: string) {
    const period = await this.prisma.financialPeriod.findUnique({
      where: { id },
      include: {
        closedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        reopenedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    if (!period) {
      throw new NotFoundException('Financial period not found');
    }

    const rangeFrom = startOfTodayUtc(period.periodStart);
    const rangeTo = endOfTodayUtc(period.periodEnd);

    const [
      salesInvoices,
      purchaseInvoices,
      draftSales,
      draftPurchases,
      draftReturns,
      settlements,
      statementExceptions,
      accountTransactions,
    ] = await this.prisma.$transaction([
      this.prisma.salesInvoice.findMany({
        where: {
          status: { in: RECEIVABLE_STATUSES },
          docDate: { lte: rangeTo },
        },
        select: {
          id: true,
          docNo: true,
          docDate: true,
          dueDate: true,
          grandTotal: true,
          amountPaid: true,
          paymentStatus: true,
          customer: {
            select: {
              id: true,
              name: true,
            },
          },
          returns: {
            where: { status: DocumentStatus.POSTED },
            select: { grandTotal: true },
          },
        },
      }),
      this.prisma.purchaseInvoice.findMany({
        where: {
          status: { in: RECEIVABLE_STATUSES },
          docDate: { lte: rangeTo },
        },
        select: {
          id: true,
          docNo: true,
          docDate: true,
          dueDate: true,
          grandTotal: true,
          amountPaid: true,
          paymentStatus: true,
          supplier: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.salesInvoice.count({
        where: {
          status: DocumentStatus.DRAFT,
          docDate: { gte: rangeFrom, lte: rangeTo },
        },
      }),
      this.prisma.purchaseInvoice.count({
        where: {
          status: DocumentStatus.DRAFT,
          docDate: { gte: rangeFrom, lte: rangeTo },
        },
      }),
      this.prisma.salesReturn.count({
        where: {
          status: DocumentStatus.DRAFT,
          docDate: { gte: rangeFrom, lte: rangeTo },
        },
      }),
      this.prisma.financeSettlement.findMany({
        where: {
          paidAt: { lte: rangeTo },
          remainingAmount: { gt: 0 },
        },
        include: {
          customer: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
        },
      }),
      this.prisma.financeStatementLine.findMany({
        where: {
          statementDate: { gte: rangeFrom, lte: rangeTo },
          status: {
            in: [
              FinanceStatementLineStatus.UNMATCHED,
              FinanceStatementLineStatus.PARTIALLY_MATCHED,
            ],
          },
        },
        include: {
          account: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
        orderBy: [{ statementDate: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.financeAccountTransaction.findMany({
        where: {
          transactionDate: { gte: rangeFrom, lte: rangeTo },
        },
        include: {
          account: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
        orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);

    const receivables = salesInvoices
      .map((doc) => {
        const creditedAmount = round2(
          (doc.returns ?? []).reduce((sum, row) => sum + Number(row.grandTotal ?? 0), 0),
        );
        const settlementTotal = round2(Math.max(0, Number(doc.grandTotal ?? 0) - creditedAmount));
        const amountPaid = Number(doc.amountPaid ?? 0);
        const outstandingAmount = calculateOutstandingAmount(settlementTotal, amountPaid);
        const paymentStatus =
          doc.paymentStatus ?? resolvePaymentStatus(settlementTotal, amountPaid);
        const due = resolveDueState({
          dueDate: doc.dueDate,
          outstandingAmount,
          paymentStatus,
          today: rangeTo,
        });

        return {
          id: doc.id,
          docNo: doc.docNo,
          docDate: doc.docDate,
          dueDate: doc.dueDate,
          party: doc.customer,
          settlementTotal,
          amountPaid,
          outstandingAmount,
          paymentStatus,
          dueState: due.dueState,
          daysPastDue: due.daysPastDue,
        };
      })
      .filter((doc) => doc.outstandingAmount > 0)
      .sort((left, right) => {
        const priority = duePriority(left.dueState) - duePriority(right.dueState);
        if (priority !== 0) return priority;
        if (left.daysPastDue !== right.daysPastDue) return right.daysPastDue - left.daysPastDue;
        return right.outstandingAmount - left.outstandingAmount;
      });

    const payables = purchaseInvoices
      .map((doc) => {
        const settlementTotal = round2(Number(doc.grandTotal ?? 0));
        const amountPaid = Number(doc.amountPaid ?? 0);
        const outstandingAmount = calculateOutstandingAmount(settlementTotal, amountPaid);
        const paymentStatus =
          doc.paymentStatus ?? resolvePaymentStatus(settlementTotal, amountPaid);
        const due = resolveDueState({
          dueDate: doc.dueDate,
          outstandingAmount,
          paymentStatus,
          today: rangeTo,
        });

        return {
          id: doc.id,
          docNo: doc.docNo,
          docDate: doc.docDate,
          dueDate: doc.dueDate,
          party: doc.supplier,
          settlementTotal,
          amountPaid,
          outstandingAmount,
          paymentStatus,
          dueState: due.dueState,
          daysPastDue: due.daysPastDue,
        };
      })
      .filter((doc) => doc.outstandingAmount > 0)
      .sort((left, right) => {
        const priority = duePriority(left.dueState) - duePriority(right.dueState);
        if (priority !== 0) return priority;
        if (left.daysPastDue !== right.daysPastDue) return right.daysPastDue - left.daysPastDue;
        return right.outstandingAmount - left.outstandingAmount;
      });

    const settlementRows = settlements
      .map((row) => ({
        id: row.id,
        entryType: row.entryType,
        status: row.status,
        paidAt: row.paidAt,
        referenceNo: row.referenceNo ?? null,
        remainingAmount: Number(row.remainingAmount ?? 0),
        unappliedAmount: Number(row.unappliedAmount ?? 0),
        allocatedAmount: Number(row.allocatedAmount ?? 0),
        party: row.customer
          ? { id: row.customer.id, name: row.customer.name }
          : row.supplier
            ? { id: row.supplier.id, name: row.supplier.name }
            : null,
      }))
      .sort((left, right) => right.remainingAmount - left.remainingAmount);

    const bankMovementMap = new Map<
      string,
      {
        account: { id: string; code: string; name: string };
        inflow: number;
        outflow: number;
        transactionCount: number;
      }
    >();

    for (const row of accountTransactions) {
      const existing =
        bankMovementMap.get(row.accountId) ??
        {
          account: {
            id: row.account.id,
            code: row.account.code,
            name: row.account.name,
          },
          inflow: 0,
          outflow: 0,
          transactionCount: 0,
        };

      if (isInboundTransaction(row.transactionType)) {
        existing.inflow += Number(row.amount ?? 0);
      } else {
        existing.outflow += Number(row.amount ?? 0);
      }

      existing.transactionCount += 1;
      bankMovementMap.set(row.accountId, existing);
    }

    const bankMovements = Array.from(bankMovementMap.values())
      .map((row) => ({
        ...row,
        inflow: round2(row.inflow),
        outflow: round2(row.outflow),
        net: round2(row.inflow - row.outflow),
      }))
      .sort((left, right) => Math.abs(right.net) - Math.abs(left.net));

    const reconciliationExceptions = statementExceptions.map((row) => ({
      id: row.id,
      statementDate: row.statementDate,
      status: row.status,
      direction: row.direction,
      amount: Number(row.amount ?? 0),
      matchedAmount: Number(row.matchedAmount ?? 0),
      remainingAmount: round2(Number(row.amount ?? 0) - Number(row.matchedAmount ?? 0)),
      referenceNo: row.referenceNo ?? null,
      counterpartyName: row.counterpartyName ?? null,
      account: row.account,
    }));

    const overdueReceivables = receivables.filter((row) => row.dueState === 'OVERDUE');
    const overduePayables = payables.filter((row) => row.dueState === 'OVERDUE');
    const unappliedReceipts = settlementRows.filter(
      (row) => row.entryType === FinanceSettlementType.RECEIPT,
    );
    const unappliedPayments = settlementRows.filter(
      (row) => row.entryType === FinanceSettlementType.PAYMENT,
    );
    const draftDocumentCount = draftSales + draftPurchases + draftReturns;
    const checklistBlockers =
      overdueReceivables.length +
      overduePayables.length +
      settlementRows.length +
      reconciliationExceptions.length +
      draftDocumentCount;

    return {
      period: this.mapPeriod(period),
      summary: {
        receivablesOutstanding: round2(
          receivables.reduce((sum, row) => sum + row.outstandingAmount, 0),
        ),
        payablesOutstanding: round2(
          payables.reduce((sum, row) => sum + row.outstandingAmount, 0),
        ),
        overdueReceivablesOutstanding: round2(
          overdueReceivables.reduce((sum, row) => sum + row.outstandingAmount, 0),
        ),
        overduePayablesOutstanding: round2(
          overduePayables.reduce((sum, row) => sum + row.outstandingAmount, 0),
        ),
        unappliedOutstanding: round2(
          settlementRows.reduce((sum, row) => sum + row.remainingAmount, 0),
        ),
        reconciliationDifference: round2(
          reconciliationExceptions.reduce((sum, row) => sum + row.remainingAmount, 0),
        ),
        bankNetMovement: round2(bankMovements.reduce((sum, row) => sum + row.net, 0)),
      },
      checklist: {
        periodReadyToClose: checklistBlockers === 0,
        blockerCount: checklistBlockers,
        overdueReceivablesCount: overdueReceivables.length,
        overduePayablesCount: overduePayables.length,
        unappliedReceiptCount: unappliedReceipts.length,
        unappliedPaymentCount: unappliedPayments.length,
        reconciliationExceptionCount: reconciliationExceptions.length,
        draftSalesCount: draftSales,
        draftPurchaseCount: draftPurchases,
        draftReturnCount: draftReturns,
      },
      receivables: receivables.slice(0, 20),
      payables: payables.slice(0, 20),
      unappliedSettlements: settlementRows.slice(0, 20),
      reconciliationExceptions: reconciliationExceptions.slice(0, 20),
      bankMovements,
    };
  }
}
