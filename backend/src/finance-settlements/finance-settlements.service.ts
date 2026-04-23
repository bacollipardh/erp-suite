import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DocumentStatus,
  FinanceSettlementStatus,
  FinanceSettlementType,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import {
  calculateFinanceSettlementRemainingAmount,
  resolveFinanceSettlementStatus,
} from '../common/utils/finance-settlements';
import { round2 } from '../common/utils/money';
import {
  calculateOutstandingAmount,
  resolveDueState,
  resolvePaymentStatus,
} from '../common/utils/payments';
import { PrismaService } from '../prisma/prisma.service';
import { ApplyFinanceSettlementDto } from './dto/apply-finance-settlement.dto';
import { ListFinanceSettlementsQueryDto } from './dto/list-finance-settlements-query.dto';
import { FinancialPeriodsService } from '../financial-periods/financial-periods.service';

const RECEIVABLE_STATUSES = [
  DocumentStatus.POSTED,
  DocumentStatus.PARTIALLY_RETURNED,
  DocumentStatus.FULLY_RETURNED,
];

function toSafeDate(value?: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function compareNullableDates(left?: Date | string | null, right?: Date | string | null) {
  return (toSafeDate(left)?.getTime() ?? 0) - (toSafeDate(right)?.getTime() ?? 0);
}

function compareStrings(left?: string | null, right?: string | null) {
  return String(left ?? '').localeCompare(String(right ?? ''), 'sq', {
    sensitivity: 'base',
  });
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
export class FinanceSettlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financialPeriodsService: FinancialPeriodsService,
  ) {}

  async getReceiptSettlements(query: ListFinanceSettlementsQueryDto = {}) {
    return this.listSettlements(FinanceSettlementType.RECEIPT, query);
  }

  async getPaymentSettlements(query: ListFinanceSettlementsQueryDto = {}) {
    return this.listSettlements(FinanceSettlementType.PAYMENT, query);
  }

  async getReceiptTargets(id: string) {
    return this.getSettlementTargets(id, FinanceSettlementType.RECEIPT);
  }

  async getPaymentTargets(id: string) {
    return this.getSettlementTargets(id, FinanceSettlementType.PAYMENT);
  }

  async applyReceiptSettlement(id: string, dto: ApplyFinanceSettlementDto, userId: string) {
    return this.applySettlement(id, FinanceSettlementType.RECEIPT, dto, userId);
  }

  async applyPaymentSettlement(id: string, dto: ApplyFinanceSettlementDto, userId: string) {
    return this.applySettlement(id, FinanceSettlementType.PAYMENT, dto, userId);
  }

  private buildSettlementWhere(
    type: FinanceSettlementType,
    query: ListFinanceSettlementsQueryDto,
  ): Prisma.FinanceSettlementWhereInput {
    return {
      entryType: type,
      status:
        query.status && query.status !== 'ALL'
          ? (query.status as FinanceSettlementStatus)
          : undefined,
      ...(type === FinanceSettlementType.RECEIPT
        ? { customerId: query.customerId }
        : { supplierId: query.supplierId }),
    };
  }

  private calculateSalesInvoiceSettlement(doc: {
    grandTotal: number | { toString(): string };
    amountPaid: number | { toString(): string };
    dueDate: Date | null;
    paymentStatus?: PaymentStatus | null;
    returns?: { grandTotal: number | { toString(): string } }[];
  }) {
    const creditedAmount = round2(
      (doc.returns ?? []).reduce((sum, entry) => sum + Number(entry.grandTotal ?? 0), 0),
    );
    const settlementTotal = round2(Math.max(0, Number(doc.grandTotal ?? 0) - creditedAmount));
    const amountPaid = round2(Number(doc.amountPaid ?? 0));
    const outstandingAmount = calculateOutstandingAmount(settlementTotal, amountPaid);
    const paymentStatus =
      doc.paymentStatus ?? resolvePaymentStatus(settlementTotal, amountPaid);

    return {
      settlementTotal,
      amountPaid,
      outstandingAmount,
      paymentStatus,
    };
  }

  private calculatePurchaseInvoiceSettlement(doc: {
    grandTotal: number | { toString(): string };
    amountPaid: number | { toString(): string };
    paymentStatus?: PaymentStatus | null;
  }) {
    const settlementTotal = round2(Number(doc.grandTotal ?? 0));
    const amountPaid = round2(Number(doc.amountPaid ?? 0));
    const outstandingAmount = calculateOutstandingAmount(settlementTotal, amountPaid);
    const paymentStatus =
      doc.paymentStatus ?? resolvePaymentStatus(settlementTotal, amountPaid);

    return {
      settlementTotal,
      amountPaid,
      outstandingAmount,
      paymentStatus,
    };
  }

  private mapAllocation(row: any) {
    const targetDocument = row.targetSalesInvoice
      ? {
          id: row.targetSalesInvoice.id,
          docNo: row.targetSalesInvoice.docNo,
          docDate: row.targetSalesInvoice.docDate,
          dueDate: row.targetSalesInvoice.dueDate ?? null,
          type: 'sales-invoices',
        }
      : row.targetPurchaseInvoice
        ? {
            id: row.targetPurchaseInvoice.id,
            docNo: row.targetPurchaseInvoice.docNo,
            docDate: row.targetPurchaseInvoice.docDate,
            dueDate: row.targetPurchaseInvoice.dueDate ?? null,
            type: 'purchase-invoices',
          }
        : null;

    return {
      id: row.id,
      amount: Number(row.amount ?? 0),
      allocatedAt: row.allocatedAt,
      notes: row.notes ?? null,
      amountPaidBefore: Number(row.amountPaidBefore ?? 0),
      amountPaidAfter: Number(row.amountPaidAfter ?? 0),
      outstandingBefore: Number(row.outstandingBefore ?? 0),
      outstandingAfter: Number(row.outstandingAfter ?? 0),
      paymentStatusBefore: row.paymentStatusBefore,
      paymentStatusAfter: row.paymentStatusAfter,
      createdAt: row.createdAt,
      createdBy: row.createdBy
        ? {
            id: row.createdBy.id,
            fullName: row.createdBy.fullName,
            email: row.createdBy.email ?? null,
          }
        : null,
      targetDocument,
    };
  }

  private mapSettlementRow(row: any) {
    const sourceDocument = row.sourceSalesInvoice
      ? {
          id: row.sourceSalesInvoice.id,
          docNo: row.sourceSalesInvoice.docNo,
          docDate: row.sourceSalesInvoice.docDate,
          dueDate: row.sourceSalesInvoice.dueDate ?? null,
          type: 'sales-invoices',
        }
      : row.sourcePurchaseInvoice
        ? {
            id: row.sourcePurchaseInvoice.id,
            docNo: row.sourcePurchaseInvoice.docNo,
            docDate: row.sourcePurchaseInvoice.docDate,
            dueDate: row.sourcePurchaseInvoice.dueDate ?? null,
            type: 'purchase-invoices',
          }
        : null;

    return {
      id: row.id,
      entryType: row.entryType,
      status: row.status,
      paidAt: row.paidAt,
      enteredAmount: Number(row.enteredAmount ?? 0),
      sourceAppliedAmount: Number(row.sourceAppliedAmount ?? 0),
      unappliedAmount: Number(row.unappliedAmount ?? 0),
      allocatedAmount: Number(row.allocatedAmount ?? 0),
      remainingAmount: Number(row.remainingAmount ?? 0),
      referenceNo: row.referenceNo ?? null,
      notes: row.notes ?? null,
      sourceAuditLogId: row.sourceAuditLogId ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      party: row.customer
        ? { id: row.customer.id, name: row.customer.name }
        : row.supplier
          ? { id: row.supplier.id, name: row.supplier.name }
          : null,
      sourceDocument,
      createdBy: row.createdBy
        ? {
            id: row.createdBy.id,
            fullName: row.createdBy.fullName,
            email: row.createdBy.email ?? null,
          }
        : null,
      allocationCount: row.allocations?.length ?? 0,
      allocations: (row.allocations ?? []).map((allocation: any) => this.mapAllocation(allocation)),
    };
  }

  private async listSettlements(
    type: FinanceSettlementType,
    query: ListFinanceSettlementsQueryDto = {},
  ) {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.max(query.limit ?? 20, 1);
    const search = query.search?.trim().toLowerCase() ?? '';
    const direction = query.sortOrder === 'asc' ? 1 : -1;
    const sortBy = query.sortBy ?? 'paidAt';

    const rows = await this.prisma.financeSettlement.findMany({
      where: this.buildSettlementWhere(type, query),
      include: {
        customer: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        sourceSalesInvoice: { select: { id: true, docNo: true, docDate: true, dueDate: true } },
        sourcePurchaseInvoice: { select: { id: true, docNo: true, docDate: true, dueDate: true } },
        createdBy: { select: { id: true, fullName: true, email: true } },
        allocations: {
          include: {
            createdBy: { select: { id: true, fullName: true, email: true } },
            targetSalesInvoice: { select: { id: true, docNo: true, docDate: true, dueDate: true } },
            targetPurchaseInvoice: {
              select: { id: true, docNo: true, docDate: true, dueDate: true },
            },
          },
          orderBy: [{ allocatedAt: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });

    const mapped = rows.map((row) => this.mapSettlementRow(row));
    const filtered = mapped.filter((row) => {
      if (!search) return true;

      const searchable = [
        row.party?.name,
        row.sourceDocument?.docNo,
        row.referenceNo,
        row.notes,
        row.createdBy?.fullName,
        row.createdBy?.email,
        ...row.allocations.map((allocation) => allocation.targetDocument?.docNo),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchable.includes(search);
    });

    const sorted = [...filtered].sort((left, right) => {
      let comparison = 0;

      switch (sortBy) {
        case 'remainingAmount':
          comparison = left.remainingAmount - right.remainingAmount;
          break;
        case 'allocatedAmount':
          comparison = left.allocatedAmount - right.allocatedAmount;
          break;
        case 'party':
          comparison = compareStrings(left.party?.name, right.party?.name);
          break;
        case 'sourceDocNo':
          comparison = compareStrings(left.sourceDocument?.docNo, right.sourceDocument?.docNo);
          break;
        case 'createdAt':
          comparison = compareNullableDates(left.createdAt, right.createdAt);
          break;
        default:
          comparison = compareNullableDates(left.paidAt, right.paidAt);
          break;
      }

      if (comparison === 0) {
        comparison = compareNullableDates(left.createdAt, right.createdAt);
      }

      if (comparison === 0) {
        comparison = compareStrings(left.sourceDocument?.docNo, right.sourceDocument?.docNo);
      }

      return comparison * direction;
    });

    const total = sorted.length;
    const pageCount = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, pageCount);
    const skip = (safePage - 1) * limit;
    const items = sorted.slice(skip, skip + limit);

    return {
      summary: {
        count: filtered.length,
        visibleCount: items.length,
        openCount: filtered.filter((row) => row.status === FinanceSettlementStatus.OPEN).length,
        partiallyAllocatedCount: filtered.filter(
          (row) => row.status === FinanceSettlementStatus.PARTIALLY_ALLOCATED,
        ).length,
        fullyAllocatedCount: filtered.filter(
          (row) => row.status === FinanceSettlementStatus.FULLY_ALLOCATED,
        ).length,
        totalEnteredAmount: round2(filtered.reduce((sum, row) => sum + row.enteredAmount, 0)),
        totalUnappliedAmount: round2(filtered.reduce((sum, row) => sum + row.unappliedAmount, 0)),
        totalAllocatedAmount: round2(filtered.reduce((sum, row) => sum + row.allocatedAmount, 0)),
        totalRemainingAmount: round2(filtered.reduce((sum, row) => sum + row.remainingAmount, 0)),
      },
      items,
      page: safePage,
      limit,
      total,
      pageCount,
    };
  }

  private async getSettlementOrThrow(id: string, type: FinanceSettlementType) {
    const settlement = await this.prisma.financeSettlement.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        sourceSalesInvoice: { select: { id: true, docNo: true, docDate: true, dueDate: true } },
        sourcePurchaseInvoice: { select: { id: true, docNo: true, docDate: true, dueDate: true } },
        createdBy: { select: { id: true, fullName: true, email: true } },
        allocations: {
          include: {
            createdBy: { select: { id: true, fullName: true, email: true } },
            targetSalesInvoice: { select: { id: true, docNo: true, docDate: true, dueDate: true } },
            targetPurchaseInvoice: {
              select: { id: true, docNo: true, docDate: true, dueDate: true },
            },
          },
          orderBy: [{ allocatedAt: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });

    if (!settlement || settlement.entryType !== type) {
      throw new NotFoundException('Finance settlement not found');
    }

    return settlement;
  }

  private async getSettlementTargets(id: string, type: FinanceSettlementType) {
    const settlement = await this.getSettlementOrThrow(id, type);

    if (type === FinanceSettlementType.RECEIPT) {
      const docs = await this.prisma.salesInvoice.findMany({
        where: {
          status: { in: RECEIVABLE_STATUSES },
          customerId: settlement.customerId ?? undefined,
          paymentStatus: { not: PaymentStatus.PAID },
        },
        select: {
          id: true,
          docNo: true,
          docDate: true,
          dueDate: true,
          grandTotal: true,
          amountPaid: true,
          paymentStatus: true,
          returns: {
            where: { status: DocumentStatus.POSTED },
            select: { grandTotal: true },
          },
        },
      });

      const targets = docs
        .map((doc) => {
          const state = this.calculateSalesInvoiceSettlement(doc);
          const due = resolveDueState({
            dueDate: doc.dueDate,
            outstandingAmount: state.outstandingAmount,
            paymentStatus: state.paymentStatus,
          });

          return {
            id: doc.id,
            docNo: doc.docNo,
            docDate: doc.docDate,
            dueDate: doc.dueDate,
            total: state.settlementTotal,
            paid: state.amountPaid,
            outstanding: state.outstandingAmount,
            paymentStatus: state.paymentStatus,
            dueState: due.dueState,
            daysPastDue: due.daysPastDue,
          };
        })
        .filter((doc) => doc.outstanding > 0)
        .sort((left, right) => {
          const priority = duePriority(left.dueState) - duePriority(right.dueState);
          if (priority !== 0) return priority;
          if (left.daysPastDue !== right.daysPastDue) return right.daysPastDue - left.daysPastDue;
          if (left.outstanding !== right.outstanding) return right.outstanding - left.outstanding;
          return compareStrings(left.docNo, right.docNo);
        });

      return {
        settlement: this.mapSettlementRow(settlement),
        targets,
      };
    }

    const docs = await this.prisma.purchaseInvoice.findMany({
      where: {
        status: { in: RECEIVABLE_STATUSES },
        supplierId: settlement.supplierId ?? undefined,
        paymentStatus: { not: PaymentStatus.PAID },
      },
      select: {
        id: true,
        docNo: true,
        docDate: true,
        dueDate: true,
        grandTotal: true,
        amountPaid: true,
        paymentStatus: true,
      },
    });

    const targets = docs
      .map((doc) => {
        const state = this.calculatePurchaseInvoiceSettlement(doc);
        const due = resolveDueState({
          dueDate: doc.dueDate,
          outstandingAmount: state.outstandingAmount,
          paymentStatus: state.paymentStatus,
        });

        return {
          id: doc.id,
          docNo: doc.docNo,
          docDate: doc.docDate,
          dueDate: doc.dueDate,
          total: state.settlementTotal,
          paid: state.amountPaid,
          outstanding: state.outstandingAmount,
          paymentStatus: state.paymentStatus,
          dueState: due.dueState,
          daysPastDue: due.daysPastDue,
        };
      })
      .filter((doc) => doc.outstanding > 0)
      .sort((left, right) => {
        const priority = duePriority(left.dueState) - duePriority(right.dueState);
        if (priority !== 0) return priority;
        if (left.daysPastDue !== right.daysPastDue) return right.daysPastDue - left.daysPastDue;
        if (left.outstanding !== right.outstanding) return right.outstanding - left.outstanding;
        return compareStrings(left.docNo, right.docNo);
      });

    return {
      settlement: this.mapSettlementRow(settlement),
      targets,
    };
  }

  private async applySettlement(
    id: string,
    type: FinanceSettlementType,
    dto: ApplyFinanceSettlementDto,
    userId: string,
  ) {
    const requestedAmount = round2(Number(dto.amount ?? 0));
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      throw new BadRequestException('Allocation amount must be greater than zero');
    }

    const allocationDate = dto.allocatedAt ? new Date(dto.allocatedAt) : new Date();
    const allocationTimestamp = dto.allocatedAt ?? allocationDate.toISOString();

    await this.financialPeriodsService.assertDateOpen(
      allocationDate,
      userId,
      'Rialokimi i bilancit financiar',
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const settlement = await tx.financeSettlement.findUnique({
        where: { id },
        include: {
          sourceSalesInvoice: { select: { id: true, docNo: true } },
          sourcePurchaseInvoice: { select: { id: true, docNo: true } },
        },
      });

      if (!settlement || settlement.entryType !== type) {
        throw new NotFoundException('Finance settlement not found');
      }

      const remainingBefore = round2(Number(settlement.remainingAmount ?? 0));
      const allocatedBefore = round2(Number(settlement.allocatedAmount ?? 0));
      if (remainingBefore <= 0) {
        throw new BadRequestException('This unapplied balance has already been fully allocated');
      }

      if (requestedAmount > remainingBefore) {
        throw new BadRequestException('Allocation exceeds the remaining unapplied balance');
      }

      if (type === FinanceSettlementType.RECEIPT) {
        const target = await tx.salesInvoice.findUnique({
          where: { id: dto.targetDocumentId },
          select: {
            id: true,
            docNo: true,
            docDate: true,
            dueDate: true,
            status: true,
            customerId: true,
            grandTotal: true,
            amountPaid: true,
            paymentStatus: true,
            returns: {
              where: { status: DocumentStatus.POSTED },
              select: { grandTotal: true },
            },
          },
        });

        if (!target) {
          throw new NotFoundException('Target sales invoice not found');
        }

        if (target.customerId !== settlement.customerId) {
          throw new BadRequestException('Unapplied receipt can only be allocated to the same customer');
        }

        if (target.status === DocumentStatus.DRAFT || target.status === DocumentStatus.CANCELLED || target.status === DocumentStatus.STORNO) {
          throw new BadRequestException('Target sales invoice is not eligible for allocation');
        }

        const settlementState = this.calculateSalesInvoiceSettlement(target);
        if (requestedAmount > settlementState.outstandingAmount) {
          throw new BadRequestException('Allocation exceeds the outstanding amount on the target invoice');
        }

        const amountPaidBefore = settlementState.amountPaid;
        const amountPaidAfter = round2(amountPaidBefore + requestedAmount);
        const outstandingBefore = settlementState.outstandingAmount;
        const outstandingAfter = calculateOutstandingAmount(
          settlementState.settlementTotal,
          amountPaidAfter,
        );
        const paymentStatusBefore = resolvePaymentStatus(
          settlementState.settlementTotal,
          amountPaidBefore,
        );
        const paymentStatusAfter = resolvePaymentStatus(
          settlementState.settlementTotal,
          amountPaidAfter,
        );

        await tx.salesInvoice.update({
          where: { id: target.id },
          data: {
            amountPaid: amountPaidAfter,
            paymentStatus: paymentStatusAfter,
          },
        });

        const allocation = await tx.financeSettlementAllocation.create({
          data: {
            settlementId: settlement.id,
            targetSalesInvoiceId: target.id,
            amount: requestedAmount,
            allocatedAt: allocationDate,
            notes: dto.notes,
            amountPaidBefore,
            amountPaidAfter,
            outstandingBefore,
            outstandingAfter,
            paymentStatusBefore,
            paymentStatusAfter,
            createdById: userId,
          },
          include: {
            createdBy: { select: { id: true, fullName: true, email: true } },
            targetSalesInvoice: { select: { id: true, docNo: true, docDate: true, dueDate: true } },
          },
        });

        const allocatedAfter = round2(allocatedBefore + requestedAmount);
        const remainingAfter = calculateFinanceSettlementRemainingAmount(
          Number(settlement.unappliedAmount ?? 0),
          allocatedAfter,
        );
        const statusAfter = resolveFinanceSettlementStatus(
          Number(settlement.unappliedAmount ?? 0),
          allocatedAfter,
        );

        await tx.financeSettlement.update({
          where: { id: settlement.id },
          data: {
            allocatedAmount: allocatedAfter,
            remainingAmount: remainingAfter,
            status: statusAfter,
          },
        });

        await tx.auditLog.create({
          data: {
            userId,
            entityType: 'finance_settlements',
            entityId: settlement.id,
            action: 'APPLY_ALLOCATION',
            metadata: {
              financeSettlementId: settlement.id,
              financeSettlementAllocationId: allocation.id,
              targetDocumentId: target.id,
              targetDocumentNo: target.docNo,
              targetDocumentType: 'sales-invoices',
              amount: requestedAmount,
              allocatedAt: allocationTimestamp,
              allocatedAmountBefore: allocatedBefore,
              allocatedAmountAfter: allocatedAfter,
              remainingAmountBefore: remainingBefore,
              remainingAmountAfter: remainingAfter,
              statusBefore: settlement.status,
              statusAfter,
              notes: dto.notes,
            } as Prisma.InputJsonValue,
          },
        });

        await tx.auditLog.create({
          data: {
            userId,
            entityType: 'sales_invoices',
            entityId: target.id,
            action: 'APPLY_UNAPPLIED_PAYMENT',
            metadata: {
              amount: requestedAmount,
              enteredAmount: requestedAmount,
              appliedAmount: requestedAmount,
              unappliedAmount: 0,
              allowUnapplied: false,
              paidAt: allocationTimestamp,
              referenceNo: settlement.referenceNo,
              notes: dto.notes,
              settlementTotal: settlementState.settlementTotal,
              amountPaidBefore,
              amountPaidAfter,
              outstandingBefore,
              outstandingAfter,
              remainingAmount: outstandingAfter,
              paymentStatusBefore,
              paymentStatusAfter,
              sourceDocumentNo: settlement.sourceSalesInvoice?.docNo ?? null,
              sourceDocumentType: 'sales-invoices',
              financeSettlementId: settlement.id,
              financeSettlementAllocationId: allocation.id,
              isReallocation: true,
            } as Prisma.InputJsonValue,
          },
        });

        const refreshedSettlement = await tx.financeSettlement.findUnique({
          where: { id: settlement.id },
          include: {
            customer: { select: { id: true, name: true } },
            supplier: { select: { id: true, name: true } },
            sourceSalesInvoice: { select: { id: true, docNo: true, docDate: true, dueDate: true } },
            sourcePurchaseInvoice: {
              select: { id: true, docNo: true, docDate: true, dueDate: true },
            },
            createdBy: { select: { id: true, fullName: true, email: true } },
            allocations: {
              include: {
                createdBy: { select: { id: true, fullName: true, email: true } },
                targetSalesInvoice: {
                  select: { id: true, docNo: true, docDate: true, dueDate: true },
                },
                targetPurchaseInvoice: {
                  select: { id: true, docNo: true, docDate: true, dueDate: true },
                },
              },
              orderBy: [{ allocatedAt: 'desc' }, { createdAt: 'desc' }],
            },
          },
        });

        return {
          settlement: this.mapSettlementRow(refreshedSettlement),
          allocation: this.mapAllocation(allocation),
        };
      }

      const target = await tx.purchaseInvoice.findUnique({
        where: { id: dto.targetDocumentId },
        select: {
          id: true,
          docNo: true,
          docDate: true,
          dueDate: true,
          status: true,
          supplierId: true,
          grandTotal: true,
          amountPaid: true,
          paymentStatus: true,
        },
      });

      if (!target) {
        throw new NotFoundException('Target purchase invoice not found');
      }

      if (target.supplierId !== settlement.supplierId) {
        throw new BadRequestException('Unapplied payment can only be allocated to the same supplier');
      }

      if (target.status === DocumentStatus.DRAFT || target.status === DocumentStatus.CANCELLED || target.status === DocumentStatus.STORNO) {
        throw new BadRequestException('Target purchase invoice is not eligible for allocation');
      }

      const settlementState = this.calculatePurchaseInvoiceSettlement(target);
      if (requestedAmount > settlementState.outstandingAmount) {
        throw new BadRequestException('Allocation exceeds the outstanding amount on the target invoice');
      }

      const amountPaidBefore = settlementState.amountPaid;
      const amountPaidAfter = round2(amountPaidBefore + requestedAmount);
      const outstandingBefore = settlementState.outstandingAmount;
      const outstandingAfter = calculateOutstandingAmount(
        settlementState.settlementTotal,
        amountPaidAfter,
      );
      const paymentStatusBefore = resolvePaymentStatus(
        settlementState.settlementTotal,
        amountPaidBefore,
      );
      const paymentStatusAfter = resolvePaymentStatus(
        settlementState.settlementTotal,
        amountPaidAfter,
      );

      await tx.purchaseInvoice.update({
        where: { id: target.id },
        data: {
          amountPaid: amountPaidAfter,
          paymentStatus: paymentStatusAfter,
        },
      });

      const allocation = await tx.financeSettlementAllocation.create({
        data: {
          settlementId: settlement.id,
          targetPurchaseInvoiceId: target.id,
          amount: requestedAmount,
          allocatedAt: allocationDate,
          notes: dto.notes,
          amountPaidBefore,
          amountPaidAfter,
          outstandingBefore,
          outstandingAfter,
          paymentStatusBefore,
          paymentStatusAfter,
          createdById: userId,
        },
        include: {
          createdBy: { select: { id: true, fullName: true, email: true } },
          targetPurchaseInvoice: {
            select: { id: true, docNo: true, docDate: true, dueDate: true },
          },
        },
      });

      const allocatedAfter = round2(allocatedBefore + requestedAmount);
      const remainingAfter = calculateFinanceSettlementRemainingAmount(
        Number(settlement.unappliedAmount ?? 0),
        allocatedAfter,
      );
      const statusAfter = resolveFinanceSettlementStatus(
        Number(settlement.unappliedAmount ?? 0),
        allocatedAfter,
      );

      await tx.financeSettlement.update({
        where: { id: settlement.id },
        data: {
          allocatedAmount: allocatedAfter,
          remainingAmount: remainingAfter,
          status: statusAfter,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          entityType: 'finance_settlements',
          entityId: settlement.id,
          action: 'APPLY_ALLOCATION',
          metadata: {
            financeSettlementId: settlement.id,
            financeSettlementAllocationId: allocation.id,
            targetDocumentId: target.id,
            targetDocumentNo: target.docNo,
            targetDocumentType: 'purchase-invoices',
            amount: requestedAmount,
            allocatedAt: allocationTimestamp,
            allocatedAmountBefore: allocatedBefore,
            allocatedAmountAfter: allocatedAfter,
            remainingAmountBefore: remainingBefore,
            remainingAmountAfter: remainingAfter,
            statusBefore: settlement.status,
            statusAfter,
            notes: dto.notes,
          } as Prisma.InputJsonValue,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          entityType: 'purchase_invoices',
          entityId: target.id,
          action: 'APPLY_UNAPPLIED_PAYMENT',
          metadata: {
            amount: requestedAmount,
            enteredAmount: requestedAmount,
            appliedAmount: requestedAmount,
            unappliedAmount: 0,
            allowUnapplied: false,
            paidAt: allocationTimestamp,
            referenceNo: settlement.referenceNo,
            notes: dto.notes,
            settlementTotal: settlementState.settlementTotal,
            amountPaidBefore,
            amountPaidAfter,
            outstandingBefore,
            outstandingAfter,
            remainingAmount: outstandingAfter,
            paymentStatusBefore,
            paymentStatusAfter,
            sourceDocumentNo: settlement.sourcePurchaseInvoice?.docNo ?? null,
            sourceDocumentType: 'purchase-invoices',
            financeSettlementId: settlement.id,
            financeSettlementAllocationId: allocation.id,
            isReallocation: true,
          } as Prisma.InputJsonValue,
        },
      });

      const refreshedSettlement = await tx.financeSettlement.findUnique({
        where: { id: settlement.id },
        include: {
          customer: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
          sourceSalesInvoice: { select: { id: true, docNo: true, docDate: true, dueDate: true } },
          sourcePurchaseInvoice: {
            select: { id: true, docNo: true, docDate: true, dueDate: true },
          },
          createdBy: { select: { id: true, fullName: true, email: true } },
          allocations: {
            include: {
              createdBy: { select: { id: true, fullName: true, email: true } },
              targetSalesInvoice: { select: { id: true, docNo: true, docDate: true, dueDate: true } },
              targetPurchaseInvoice: {
                select: { id: true, docNo: true, docDate: true, dueDate: true },
              },
            },
            orderBy: [{ allocatedAt: 'desc' }, { createdAt: 'desc' }],
          },
        },
      });

      return {
        settlement: this.mapSettlementRow(refreshedSettlement),
        allocation: this.mapAllocation(allocation),
      };
    });

    return result;
  }
}
