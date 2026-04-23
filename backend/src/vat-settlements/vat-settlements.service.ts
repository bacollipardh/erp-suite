import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, VatSettlementStatus } from '@prisma/client';
import { AccountingService } from '../accounting/accounting.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  formatFinancialPeriodLabel,
  getFinancialPeriodKey,
  normalizeFinancialDate,
} from '../common/utils/financial-periods';
import { round2 } from '../common/utils/money';
import { FinanceAccountsService } from '../finance-accounts/finance-accounts.service';
import { FinancialPeriodsService } from '../financial-periods/financial-periods.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVatSettlementDto } from './dto/create-vat-settlement.dto';
import { FileVatSettlementDto } from './dto/file-vat-settlement.dto';
import { ListVatSettlementsQueryDto } from './dto/list-vat-settlements-query.dto';
import { RecordVatPaymentDto } from './dto/record-vat-payment.dto';
import {
  buildVatSettlementNo,
  resolveVatSettlementStatus,
} from './vat-settlements.utils';

type VatSettlementRow = Prisma.VatSettlementGetPayload<{
  include: {
    financialPeriod: true;
    createdBy: { select: { id: true; fullName: true; email: true } };
    paidFinanceAccount: { select: { id: true; code: true; name: true; accountType: true } };
  };
}>;

function normalizeOptional(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function startOfTodayUtc(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

@Injectable()
export class VatSettlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingService: AccountingService,
    private readonly financeAccountsService: FinanceAccountsService,
    private readonly financialPeriodsService: FinancialPeriodsService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  private mapPeriod(
    row: {
      id: string;
      year: number;
      month: number;
      periodStart: Date;
      periodEnd: Date;
      status: string;
    },
  ) {
    return {
      id: row.id,
      key: getFinancialPeriodKey(row.year, row.month),
      label: formatFinancialPeriodLabel(row.year, row.month),
      year: row.year,
      month: row.month,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      status: row.status,
    };
  }

  private buildSettlementLines(params: {
    outputVat: number;
    inputVat: number;
    payableAmount: number;
    receivableAmount: number;
  }) {
    const lines: Array<{
      accountCode: string;
      accountName: string;
      side: 'DEBIT' | 'CREDIT';
      amount: number;
    }> = [];

    if (params.outputVat > 0) {
      lines.push({
        accountCode: 'VAT_OUTPUT',
        accountName: 'TVSH e Daljes',
        side: 'DEBIT',
        amount: round2(params.outputVat),
      });
    }

    if (params.inputVat > 0) {
      lines.push({
        accountCode: 'VAT_INPUT',
        accountName: 'TVSH e Zbritshme',
        side: 'CREDIT',
        amount: round2(params.inputVat),
      });
    }

    if (params.payableAmount > 0) {
      lines.push({
        accountCode: 'VAT_PAYABLE',
        accountName: 'Detyrim TVSH',
        side: 'CREDIT',
        amount: round2(params.payableAmount),
      });
    }

    if (params.receivableAmount > 0) {
      lines.push({
        accountCode: 'VAT_RECEIVABLE',
        accountName: 'TVSH e Arketueshme',
        side: 'DEBIT',
        amount: round2(params.receivableAmount),
      });
    }

    return lines;
  }

  private async findSettlementRow(id: string) {
    const settlement = await this.prisma.vatSettlement.findUnique({
      where: { id },
      include: {
        financialPeriod: true,
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        paidFinanceAccount: {
          select: {
            id: true,
            code: true,
            name: true,
            accountType: true,
          },
        },
      },
    });

    if (!settlement) {
      throw new NotFoundException('VAT settlement not found');
    }

    return settlement;
  }

  private async mapSettlement(row: VatSettlementRow) {
    const [journalEntry, payments] = await this.prisma.$transaction([
      this.prisma.journalEntry.findFirst({
        where: {
          sourceType: 'VAT_SETTLEMENT',
          sourceId: row.id,
        },
        select: {
          id: true,
          entryNo: true,
          entryDate: true,
          description: true,
          sourceNo: true,
        },
      }),
      this.prisma.financeAccountTransaction.findMany({
        where: {
          sourceDocumentType: 'vat-settlements',
          sourceDocumentId: row.id,
        },
        include: {
          account: {
            select: {
              id: true,
              code: true,
              name: true,
              accountType: true,
            },
          },
        },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);

    const paidAmount = round2(Number(row.paidAmount ?? 0));
    const payableAmount = round2(Number(row.payableAmount ?? 0));
    const receivableAmount = round2(Number(row.receivableAmount ?? 0));
    const remainingPayableAmount = round2(Math.max(payableAmount - paidAmount, 0));
    const today = startOfTodayUtc(new Date());
    const dueDate = row.dueDate ? startOfTodayUtc(row.dueDate) : null;

    return {
      id: row.id,
      settlementNo: row.settlementNo,
      settlementDate: row.settlementDate,
      dueDate: row.dueDate,
      status: row.status,
      outputTaxableBase: round2(Number(row.outputTaxableBase ?? 0)),
      outputVat: round2(Number(row.outputVat ?? 0)),
      inputTaxableBase: round2(Number(row.inputTaxableBase ?? 0)),
      inputVat: round2(Number(row.inputVat ?? 0)),
      netVatAmount: round2(Number(row.netVatAmount ?? 0)),
      payableAmount,
      receivableAmount,
      paidAmount,
      remainingPayableAmount,
      filedAt: row.filedAt,
      filingReferenceNo: row.filingReferenceNo ?? null,
      paidAt: row.paidAt,
      referenceNo: row.referenceNo ?? null,
      notes: row.notes ?? null,
      isFiled: Boolean(row.filedAt),
      isOverdue:
        Boolean(dueDate) &&
        remainingPayableAmount > 0 &&
        dueDate!.getTime() < today.getTime(),
      period: this.mapPeriod(row.financialPeriod),
      createdBy: {
        id: row.createdBy.id,
        fullName: row.createdBy.fullName,
        email: row.createdBy.email ?? null,
      },
      paidFinanceAccount: row.paidFinanceAccount
        ? {
            id: row.paidFinanceAccount.id,
            code: row.paidFinanceAccount.code,
            name: row.paidFinanceAccount.name,
            accountType: row.paidFinanceAccount.accountType,
          }
        : null,
      journalEntry: journalEntry
        ? {
            id: journalEntry.id,
            entryNo: journalEntry.entryNo,
            entryDate: journalEntry.entryDate,
            description: journalEntry.description,
            sourceNo: journalEntry.sourceNo ?? null,
          }
        : null,
      payments: payments.map((payment) => ({
        id: payment.id,
        transactionDate: payment.transactionDate,
        amount: round2(Number(payment.amount ?? 0)),
        referenceNo: payment.referenceNo ?? null,
        notes: payment.notes ?? null,
        account: payment.account,
      })),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async findAll(query: ListVatSettlementsQueryDto = {}) {
    const year = query.year ?? new Date().getUTCFullYear();
    await this.financialPeriodsService.ensureYearPeriods(year);

    const rows = await this.prisma.vatSettlement.findMany({
      where: {
        financialPeriod: { year },
        status: query.status,
      },
      include: {
        financialPeriod: true,
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        paidFinanceAccount: {
          select: {
            id: true,
            code: true,
            name: true,
            accountType: true,
          },
        },
      },
      orderBy: [
        { financialPeriod: { year: 'desc' } },
        { financialPeriod: { month: 'desc' } },
      ],
    });

    const items = rows.map((row) => {
      const payableAmount = round2(Number(row.payableAmount ?? 0));
      const receivableAmount = round2(Number(row.receivableAmount ?? 0));
      const paidAmount = round2(Number(row.paidAmount ?? 0));
      const remainingPayableAmount = round2(Math.max(payableAmount - paidAmount, 0));
      const today = startOfTodayUtc(new Date());
      const dueDate = row.dueDate ? startOfTodayUtc(row.dueDate) : null;

      return {
        id: row.id,
        settlementNo: row.settlementNo,
        settlementDate: row.settlementDate,
        dueDate: row.dueDate,
        status: row.status,
        netVatAmount: round2(Number(row.netVatAmount ?? 0)),
        payableAmount,
        receivableAmount,
        paidAmount,
        remainingPayableAmount,
        filedAt: row.filedAt,
        filingReferenceNo: row.filingReferenceNo ?? null,
        paidAt: row.paidAt,
        referenceNo: row.referenceNo ?? null,
        isFiled: Boolean(row.filedAt),
        isOverdue:
          Boolean(dueDate) &&
          remainingPayableAmount > 0 &&
          dueDate!.getTime() < today.getTime(),
        period: this.mapPeriod(row.financialPeriod),
        paidFinanceAccount: row.paidFinanceAccount
          ? {
              id: row.paidFinanceAccount.id,
              code: row.paidFinanceAccount.code,
              name: row.paidFinanceAccount.name,
              accountType: row.paidFinanceAccount.accountType,
            }
          : null,
      };
    });

    return {
      year,
      items,
      summary: {
        count: items.length,
        payableTotal: round2(items.reduce((sum, item) => sum + item.payableAmount, 0)),
        receivableTotal: round2(items.reduce((sum, item) => sum + item.receivableAmount, 0)),
        paidTotal: round2(items.reduce((sum, item) => sum + item.paidAmount, 0)),
        openCount: items.filter(
          (item) =>
            item.status === VatSettlementStatus.SETTLED ||
            item.status === VatSettlementStatus.PARTIALLY_PAID,
        ).length,
        filedCount: items.filter((item) => item.isFiled).length,
        overdueCount: items.filter((item) => item.isOverdue).length,
      },
    };
  }

  async getOne(id: string) {
    const settlement = await this.findSettlementRow(id);
    return this.mapSettlement(settlement);
  }

  async getPreview(financialPeriodId: string) {
    const period = await this.prisma.financialPeriod.findUnique({
      where: { id: financialPeriodId },
      select: {
        id: true,
        year: true,
        month: true,
        periodStart: true,
        periodEnd: true,
        status: true,
      },
    });

    if (!period) {
      throw new NotFoundException('Financial period not found');
    }

    const existing = await this.prisma.vatSettlement.findUnique({
      where: { financialPeriodId },
      include: {
        financialPeriod: true,
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        paidFinanceAccount: {
          select: {
            id: true,
            code: true,
            name: true,
            accountType: true,
          },
        },
      },
    });

    const ledger = await this.accountingService.getVatLedger({
      dateFrom: period.periodStart.toISOString(),
      dateTo: period.periodEnd.toISOString(),
      page: 1,
      limit: 50,
      sortBy: 'docDate',
      sortOrder: 'desc',
    });

    const outputVat = round2(Number(ledger.summary.outputVat ?? 0));
    const inputVat = round2(Number(ledger.summary.inputVat ?? 0));
    const netVatAmount = round2(outputVat - inputVat);
    const payableAmount = round2(Math.max(netVatAmount, 0));
    const receivableAmount = round2(Math.max(-netVatAmount, 0));
    const paidAmount = round2(Number(existing?.paidAmount ?? 0));

    return {
      period: this.mapPeriod(period),
      ledger: {
        summary: ledger.summary,
        items: ledger.items,
      },
      proposed: {
        settlementNo:
          existing?.settlementNo ?? buildVatSettlementNo(period.year, period.month),
        settlementDate: existing?.settlementDate ?? period.periodEnd,
        dueDate: existing?.dueDate ?? null,
        outputTaxableBase: round2(Number(ledger.summary.outputTaxableBase ?? 0)),
        outputVat,
        inputTaxableBase: round2(Number(ledger.summary.inputTaxableBase ?? 0)),
        inputVat,
        netVatAmount,
        payableAmount,
        receivableAmount,
        paidAmount,
        remainingPayableAmount: round2(Math.max(payableAmount - paidAmount, 0)),
        status: resolveVatSettlementStatus(payableAmount, receivableAmount, paidAmount),
        lines: this.buildSettlementLines({
          outputVat,
          inputVat,
          payableAmount,
          receivableAmount,
        }),
      },
      existingSettlement: existing ? await this.mapSettlement(existing) : null,
    };
  }

  async createOrUpdate(dto: CreateVatSettlementDto, userId: string) {
    const preview = await this.getPreview(dto.financialPeriodId);
    const existing = await this.prisma.vatSettlement.findUnique({
      where: { financialPeriodId: dto.financialPeriodId },
      select: {
        id: true,
        status: true,
        paidAmount: true,
        filedAt: true,
        settlementNo: true,
        createdById: true,
      },
    });

    if (existing && (existing.filedAt || Number(existing.paidAmount ?? 0) > 0)) {
      throw new BadRequestException(
        'Settlement-i i TVSH-se nuk mund te rihapet pasi eshte filed ose ka pagesa te regjistruara.',
      );
    }

    const settlementDate = normalizeFinancialDate(
      dto.settlementDate ?? preview.period.periodEnd,
    );

    if (
      settlementDate.getTime() < new Date(preview.period.periodStart).getTime() ||
      settlementDate.getTime() > new Date(preview.period.periodEnd).getTime()
    ) {
      throw new BadRequestException(
        'Data e settlement-it duhet te jete brenda periudhes financiare te zgjedhur.',
      );
    }

    await this.financialPeriodsService.assertDateOpen(
      settlementDate,
      userId,
      `Settlement TVSH per ${preview.period.label}`,
    );

    const dueDate = dto.dueDate ? normalizeFinancialDate(dto.dueDate) : null;
    const referenceNo = normalizeOptional(dto.referenceNo);
    const notes = normalizeOptional(dto.notes);
    const payableAmount = round2(preview.proposed.payableAmount);
    const receivableAmount = round2(preview.proposed.receivableAmount);
    const paidAmount = round2(Number(existing?.paidAmount ?? 0));
    const status = resolveVatSettlementStatus(payableAmount, receivableAmount, paidAmount);

    const settlement = await this.prisma.$transaction(async (tx) => {
      const row = existing
        ? await tx.vatSettlement.update({
            where: { id: existing.id },
            data: {
              settlementDate,
              dueDate,
              status,
              outputTaxableBase: preview.proposed.outputTaxableBase,
              outputVat: preview.proposed.outputVat,
              inputTaxableBase: preview.proposed.inputTaxableBase,
              inputVat: preview.proposed.inputVat,
              netVatAmount: preview.proposed.netVatAmount,
              payableAmount,
              receivableAmount,
              referenceNo,
              notes,
            },
            include: {
              financialPeriod: true,
              createdBy: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                },
              },
              paidFinanceAccount: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  accountType: true,
                },
              },
            },
          })
        : await tx.vatSettlement.create({
            data: {
              financialPeriodId: dto.financialPeriodId,
              settlementNo: preview.proposed.settlementNo,
              settlementDate,
              dueDate,
              status,
              outputTaxableBase: preview.proposed.outputTaxableBase,
              outputVat: preview.proposed.outputVat,
              inputTaxableBase: preview.proposed.inputTaxableBase,
              inputVat: preview.proposed.inputVat,
              netVatAmount: preview.proposed.netVatAmount,
              payableAmount,
              receivableAmount,
              paidAmount: 0,
              referenceNo,
              notes,
              createdById: userId,
            },
            include: {
              financialPeriod: true,
              createdBy: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                },
              },
              paidFinanceAccount: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  accountType: true,
                },
              },
            },
          });

      if (preview.proposed.lines.length === 0) {
        await tx.journalEntry.deleteMany({
          where: {
            sourceType: 'VAT_SETTLEMENT',
            sourceId: row.id,
          },
        });
      } else {
        await this.accountingService.postVatSettlementTx(tx, {
          settlementId: row.id,
          settlementNo: row.settlementNo,
          settlementDate,
          outputVat: preview.proposed.outputVat,
          inputVat: preview.proposed.inputVat,
          payableAmount,
          receivableAmount,
          notes,
          createdById: userId,
        });
      }

      return row;
    });

    await this.auditLogs.log({
      userId,
      entityType: 'vat_settlements',
      entityId: settlement.id,
      action: existing ? 'UPDATE_SETTLEMENT' : 'CREATE_SETTLEMENT',
      metadata: {
        financialPeriodId: settlement.financialPeriodId,
        settlementNo: settlement.settlementNo,
        status,
        payableAmount,
        receivableAmount,
        dueDate: dueDate?.toISOString() ?? null,
      },
    });

    return this.getOne(settlement.id);
  }

  async fileSettlement(id: string, dto: FileVatSettlementDto, userId: string) {
    const settlement = await this.findSettlementRow(id);
    const filedAt = normalizeFinancialDate(dto.filedAt ?? new Date());
    const filingReferenceNo = normalizeOptional(dto.filingReferenceNo);
    const notes = normalizeOptional(dto.notes) ?? settlement.notes ?? null;

    const updated = await this.prisma.vatSettlement.update({
      where: { id },
      data: {
        filedAt,
        filingReferenceNo,
        notes,
      },
    });

    await this.auditLogs.log({
      userId,
      entityType: 'vat_settlements',
      entityId: updated.id,
      action: 'FILE_SETTLEMENT',
      metadata: {
        settlementNo: settlement.settlementNo,
        filedAt: filedAt.toISOString(),
        filingReferenceNo,
      },
    });

    return this.getOne(id);
  }

  async recordPayment(id: string, dto: RecordVatPaymentDto, userId: string) {
    const settlement = await this.findSettlementRow(id);
    const payableAmount = round2(Number(settlement.payableAmount ?? 0));
    const paidAmount = round2(Number(settlement.paidAmount ?? 0));
    const remainingPayableAmount = round2(Math.max(payableAmount - paidAmount, 0));

    if (payableAmount <= 0) {
      throw new BadRequestException(
        'Ky settlement i TVSH-se nuk ka detyrim per pagese.',
      );
    }

    const amount = round2(Number(dto.amount ?? 0));
    if (amount <= 0) {
      throw new BadRequestException('Shuma e pageses duhet te jete me e madhe se zero.');
    }

    if (amount > remainingPayableAmount) {
      throw new BadRequestException(
        `Pagesa e TVSH-se nuk mund te kaloje mbetjen ${remainingPayableAmount.toFixed(2)} EUR.`,
      );
    }

    const transactionDate = normalizeFinancialDate(dto.transactionDate);

    const payment = await this.prisma.$transaction(async (tx) => {
      const createdPayment = await this.financeAccountsService.recordVatPaymentTransactionTx(tx, {
        financeAccountId: dto.financeAccountId,
        vatSettlementId: settlement.id,
        settlementNo: settlement.settlementNo,
        amount,
        transactionDate,
        createdById: userId,
        referenceNo: dto.referenceNo,
        notes: dto.notes,
      });

      const nextPaidAmount = round2(paidAmount + amount);

      await tx.vatSettlement.update({
        where: { id: settlement.id },
        data: {
          paidAmount: nextPaidAmount,
          paidAt: transactionDate,
          paidFinanceAccountId: dto.financeAccountId,
          status: resolveVatSettlementStatus(
            payableAmount,
            Number(settlement.receivableAmount ?? 0),
            nextPaidAmount,
          ),
        },
      });

      return createdPayment;
    });

    await this.auditLogs.log({
      userId,
      entityType: 'vat_settlements',
      entityId: settlement.id,
      action: 'RECORD_PAYMENT',
      metadata: {
        settlementNo: settlement.settlementNo,
        financeAccountId: dto.financeAccountId,
        transactionId: payment.id,
        amount,
        transactionDate: transactionDate.toISOString(),
        referenceNo: normalizeOptional(dto.referenceNo),
      },
    });

    return this.getOne(id);
  }
}
