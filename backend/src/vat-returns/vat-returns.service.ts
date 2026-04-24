import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, VatReturnStatus } from '@prisma/client';
import { AccountingService } from '../accounting/accounting.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CompanyProfileService } from '../company-profile/company-profile.service';
import {
  formatFinancialPeriodLabel,
  getFinancialPeriodKey,
  normalizeFinancialDate,
} from '../common/utils/financial-periods';
import { round2 } from '../common/utils/money';
import { PdfService } from '../pdf/pdf.service';
import { PrismaService } from '../prisma/prisma.service';
import { VatSettlementsService } from '../vat-settlements/vat-settlements.service';
import { CreateVatReturnDto } from './dto/create-vat-return.dto';
import { FileVatReturnDto } from './dto/file-vat-return.dto';
import { ListVatReturnsQueryDto } from './dto/list-vat-returns-query.dto';
import {
  buildVatReturnBoxes,
  buildVatReturnExportBaseName,
  buildVatReturnNo,
  resolveVatReturnStatus,
} from './vat-returns.utils';

type VatReturnRow = Prisma.VatReturnGetPayload<{
  include: {
    createdBy: { select: { id: true; fullName: true; email: true } };
    vatSettlement: {
      include: {
        financialPeriod: true;
        createdBy: { select: { id: true; fullName: true; email: true } };
        paidFinanceAccount: {
          select: { id: true; code: true; name: true; accountType: true };
        };
      };
    };
  };
}>;

function normalizeOptional(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function csvEscape(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function csvRow(values: Array<string | number | null | undefined>) {
  return values.map(csvEscape).join(',');
}

@Injectable()
export class VatReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingService: AccountingService,
    private readonly companyProfileService: CompanyProfileService,
    private readonly vatSettlementsService: VatSettlementsService,
    private readonly pdfService: PdfService,
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

  private serializeCompany(profile: Record<string, unknown> | null | undefined) {
    return {
      name: String(profile?.name ?? 'bp ERP System'),
      fiscalNo: typeof profile?.fiscalNo === 'string' ? profile.fiscalNo : null,
      vatNo: typeof profile?.vatNo === 'string' ? profile.vatNo : null,
      businessNo:
        typeof profile?.businessNo === 'string' ? profile.businessNo : null,
      address: typeof profile?.address === 'string' ? profile.address : null,
      city: typeof profile?.city === 'string' ? profile.city : null,
      phone: typeof profile?.phone === 'string' ? profile.phone : null,
      email: typeof profile?.email === 'string' ? profile.email : null,
      website: typeof profile?.website === 'string' ? profile.website : null,
    };
  }

  private async findReturnRow(id: string) {
    const item = await this.prisma.vatReturn.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        vatSettlement: {
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
        },
      },
    });

    if (!item) {
      throw new NotFoundException('VAT return not found');
    }

    return item;
  }

  private mapSettlement(row: VatReturnRow['vatSettlement']) {
    const payableAmount = round2(Number(row.payableAmount ?? 0));
    const receivableAmount = round2(Number(row.receivableAmount ?? 0));
    const paidAmount = round2(Number(row.paidAmount ?? 0));
    const remainingPayableAmount = round2(Math.max(payableAmount - paidAmount, 0));

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
      referenceNo: row.referenceNo ?? null,
      notes: row.notes ?? null,
      paidAt: row.paidAt,
      paidFinanceAccount: row.paidFinanceAccount
        ? {
            id: row.paidFinanceAccount.id,
            code: row.paidFinanceAccount.code,
            name: row.paidFinanceAccount.name,
            accountType: row.paidFinanceAccount.accountType,
          }
        : null,
      period: this.mapPeriod(row.financialPeriod),
      createdBy: {
        id: row.createdBy.id,
        fullName: row.createdBy.fullName,
        email: row.createdBy.email ?? null,
      },
    };
  }

  private mapReturn(row: VatReturnRow) {
    const snapshot =
      row.snapshot && typeof row.snapshot === 'object' && !Array.isArray(row.snapshot)
        ? (row.snapshot as Record<string, any>)
        : {};
    const settlement = this.mapSettlement(row.vatSettlement);
    const company = this.serializeCompany(snapshot.company);
    const period = snapshot.period && typeof snapshot.period === 'object'
      ? {
          ...this.mapPeriod(row.vatSettlement.financialPeriod),
          ...snapshot.period,
        }
      : settlement.period;
    const paidAmount = settlement.paidAmount;

    const boxes = Array.isArray(snapshot.declaration?.boxes)
      ? snapshot.declaration.boxes
      : buildVatReturnBoxes({
          outputTaxableBase: Number(row.outputTaxableBase ?? 0),
          outputVat: Number(row.outputVat ?? 0),
          inputTaxableBase: Number(row.inputTaxableBase ?? 0),
          inputVat: Number(row.inputVat ?? 0),
          manualOutputVat: Number(row.manualOutputVat ?? 0),
          manualInputVat: Number(row.manualInputVat ?? 0),
          payableAmount: Number(row.payableAmount ?? 0),
          receivableAmount: Number(row.receivableAmount ?? 0),
          paidAmount,
        });
    const exportBaseName = buildVatReturnExportBaseName(row.returnNo);

    return {
      id: row.id,
      returnNo: row.returnNo,
      declarationDate: row.declarationDate,
      dueDate: row.dueDate,
      status: row.status,
      currencyCode: row.currencyCode,
      filedAt: row.filedAt,
      filingReferenceNo: row.filingReferenceNo ?? null,
      notes: row.notes ?? null,
      outputTaxableBase: round2(Number(row.outputTaxableBase ?? 0)),
      outputVat: round2(Number(row.outputVat ?? 0)),
      inputTaxableBase: round2(Number(row.inputTaxableBase ?? 0)),
      inputVat: round2(Number(row.inputVat ?? 0)),
      manualOutputVat: round2(Number(row.manualOutputVat ?? 0)),
      manualInputVat: round2(Number(row.manualInputVat ?? 0)),
      netVatAmount: round2(Number(row.netVatAmount ?? 0)),
      payableAmount: round2(Number(row.payableAmount ?? 0)),
      receivableAmount: round2(Number(row.receivableAmount ?? 0)),
      company,
      period,
      settlement,
      declaration: {
        boxes,
        metrics:
          snapshot.declaration && typeof snapshot.declaration === 'object'
            ? snapshot.declaration.metrics ?? null
            : null,
        statement:
          snapshot.declaration && typeof snapshot.declaration === 'object'
            ? snapshot.declaration.statement ?? null
            : null,
      },
      createdBy: {
        id: row.createdBy.id,
        fullName: row.createdBy.fullName,
        email: row.createdBy.email ?? null,
      },
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      exports: {
        csvPath: `/vat-returns/${row.id}/export/csv`,
        jsonPath: `/vat-returns/${row.id}/export/json`,
        pdfPath: `/vat-returns/${row.id}/export/pdf`,
        pdfPreviewPath: `/vat-returns/${row.id}/export/pdf?mode=preview`,
        baseName: exportBaseName,
      },
      snapshot,
    };
  }

  private async buildPreview(financialPeriodId: string, declarationDateOverride?: string) {
    const [period, companyProfile, settlement] = await Promise.all([
      this.prisma.financialPeriod.findUnique({
        where: { id: financialPeriodId },
        select: {
          id: true,
          year: true,
          month: true,
          periodStart: true,
          periodEnd: true,
          status: true,
        },
      }),
      this.companyProfileService.get(),
      this.prisma.vatSettlement.findUnique({
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
          vatReturn: {
            include: {
              createdBy: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                },
              },
            },
          },
        },
      }),
    ]);

    if (!period) {
      throw new NotFoundException('Financial period not found');
    }

    const company = this.serializeCompany(companyProfile as Record<string, unknown>);
    const mappedPeriod = this.mapPeriod(period);

    if (!settlement) {
      return {
        period: mappedPeriod,
        company,
        canGenerate: false,
        isLocked: false,
        blockingReason:
          'Deklarata mujore e TVSH-se kerkon settlement te gjeneruar me pare per kete periudhe.',
        settlement: null,
        proposed: null,
        existingReturn: null,
      };
    }

    const ledger = await this.accountingService.getVatLedger({
      dateFrom: period.periodStart.toISOString(),
      dateTo: period.periodEnd.toISOString(),
      page: 1,
      limit: 5000,
    });

    const manualRows = ledger.items.filter(
      (item) =>
        !['SALES_INVOICE', 'SALES_RETURN', 'PURCHASE_INVOICE'].includes(item.entryKind),
    );
    const manualOutputVat = round2(
      manualRows
        .filter((item) => item.side === 'OUTPUT')
        .reduce((sum, item) => sum + Number(item.vatAmount ?? 0), 0),
    );
    const manualInputVat = round2(
      manualRows
        .filter((item) => item.side === 'INPUT')
        .reduce((sum, item) => sum + Number(item.vatAmount ?? 0), 0),
    );
    const settlementSummary = this.mapSettlement(settlement);
    const declarationDate = normalizeFinancialDate(
      declarationDateOverride ??
        settlement.vatReturn?.declarationDate ??
        new Date(),
    );
    const boxes = buildVatReturnBoxes({
      outputTaxableBase: Number(settlement.outputTaxableBase ?? 0),
      outputVat: Number(settlement.outputVat ?? 0),
      inputTaxableBase: Number(settlement.inputTaxableBase ?? 0),
      inputVat: Number(settlement.inputVat ?? 0),
      manualOutputVat,
      manualInputVat,
      payableAmount: Number(settlement.payableAmount ?? 0),
      receivableAmount: Number(settlement.receivableAmount ?? 0),
      paidAmount: Number(settlement.paidAmount ?? 0),
    });

    const statement = {
      sales: {
        taxableBase: round2(Number(settlement.outputTaxableBase ?? 0)),
        vatAmount: round2(Number(settlement.outputVat ?? 0)),
      },
      purchases: {
        taxableBase: round2(Number(settlement.inputTaxableBase ?? 0)),
        vatAmount: round2(Number(settlement.inputVat ?? 0)),
      },
      adjustments: {
        manualOutputVat,
        manualInputVat,
        netEffect: round2(manualOutputVat - manualInputVat),
      },
      result: {
        netVatAmount: round2(Number(settlement.netVatAmount ?? 0)),
        payableAmount: round2(Number(settlement.payableAmount ?? 0)),
        receivableAmount: round2(Number(settlement.receivableAmount ?? 0)),
        paidAmount: round2(Number(settlement.paidAmount ?? 0)),
        remainingPayableAmount: settlementSummary.remainingPayableAmount,
      },
    };

    const existingReturn = settlement.vatReturn
      ? this.mapReturn({
          ...settlement.vatReturn,
          vatSettlement: settlement,
        } as VatReturnRow)
      : null;

    return {
      period: mappedPeriod,
      company,
      canGenerate: settlement.vatReturn?.status !== VatReturnStatus.FILED,
      isLocked: settlement.vatReturn?.status === VatReturnStatus.FILED,
      blockingReason: null,
      settlement: settlementSummary,
      proposed: {
        returnNo: settlement.vatReturn?.returnNo ?? buildVatReturnNo(period.year, period.month),
        declarationDate,
        dueDate: settlement.dueDate,
        currencyCode: settlement.vatReturn?.currencyCode ?? 'EUR',
        status:
          settlement.vatReturn?.status ?? resolveVatReturnStatus(settlement.filedAt ?? null),
        outputTaxableBase: round2(Number(settlement.outputTaxableBase ?? 0)),
        outputVat: round2(Number(settlement.outputVat ?? 0)),
        inputTaxableBase: round2(Number(settlement.inputTaxableBase ?? 0)),
        inputVat: round2(Number(settlement.inputVat ?? 0)),
        manualOutputVat,
        manualInputVat,
        netVatAmount: round2(Number(settlement.netVatAmount ?? 0)),
        payableAmount: round2(Number(settlement.payableAmount ?? 0)),
        receivableAmount: round2(Number(settlement.receivableAmount ?? 0)),
        paidAmount: round2(Number(settlement.paidAmount ?? 0)),
        remainingPayableAmount: settlementSummary.remainingPayableAmount,
        boxes,
        metrics: {
          documentCount: Number(ledger.summary?.documentCount ?? 0),
          manualAdjustmentCount: Number(ledger.summary?.manualAdjustmentCount ?? 0),
        },
        statement,
      },
      existingReturn,
    };
  }

  async findAll(query: ListVatReturnsQueryDto = {}) {
    const year = query.year ?? new Date().getUTCFullYear();

    const rows = await this.prisma.vatReturn.findMany({
      where: {
        vatSettlement: {
          financialPeriod: { year },
        },
        status: query.status,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        vatSettlement: {
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
        },
      },
      orderBy: [
        { vatSettlement: { financialPeriod: { year: 'desc' } } },
        { vatSettlement: { financialPeriod: { month: 'desc' } } },
      ],
    });

    const items = rows.map((row) => this.mapReturn(row));

    return {
      year,
      items,
      summary: {
        count: items.length,
        readyCount: items.filter((item) => item.status === VatReturnStatus.READY).length,
        filedCount: items.filter((item) => item.status === VatReturnStatus.FILED).length,
        payableTotal: round2(
          items.reduce((sum, item) => sum + Number(item.payableAmount ?? 0), 0),
        ),
        receivableTotal: round2(
          items.reduce((sum, item) => sum + Number(item.receivableAmount ?? 0), 0),
        ),
      },
    };
  }

  async getOne(id: string) {
    const item = await this.findReturnRow(id);
    return this.mapReturn(item);
  }

  async getPreview(financialPeriodId: string) {
    return this.buildPreview(financialPeriodId);
  }

  async createOrUpdate(dto: CreateVatReturnDto, userId: string) {
    const preview = await this.buildPreview(dto.financialPeriodId, dto.declarationDate);

    if (!preview.canGenerate || !preview.settlement || !preview.proposed) {
      throw new BadRequestException(
        preview.blockingReason ??
          'Deklarata mujore e TVSH-se nuk mund te gjenerohet per kete periudhe.',
      );
    }

    if (preview.existingReturn?.status === VatReturnStatus.FILED) {
      throw new BadRequestException(
        'Deklarata e TVSH-se eshte filing dhe nuk mund te ndryshohet pa rihapje.',
      );
    }

    const declarationDate = normalizeFinancialDate(
      dto.declarationDate ?? preview.proposed.declarationDate,
    );
    const notes = normalizeOptional(dto.notes) ?? preview.existingReturn?.notes ?? null;

    const snapshot = {
      company: preview.company,
      period: preview.period,
      settlement: preview.settlement,
      declaration: {
        boxes: preview.proposed.boxes,
        metrics: preview.proposed.metrics,
        statement: preview.proposed.statement,
      },
    };

    const saved = await this.prisma.vatReturn.upsert({
      where: { vatSettlementId: preview.settlement.id },
      update: {
        declarationDate,
        dueDate: preview.proposed.dueDate
          ? normalizeFinancialDate(preview.proposed.dueDate)
          : null,
        status: resolveVatReturnStatus(preview.settlement.filedAt),
        currencyCode: preview.proposed.currencyCode,
        outputTaxableBase: preview.proposed.outputTaxableBase,
        outputVat: preview.proposed.outputVat,
        inputTaxableBase: preview.proposed.inputTaxableBase,
        inputVat: preview.proposed.inputVat,
        manualOutputVat: preview.proposed.manualOutputVat,
        manualInputVat: preview.proposed.manualInputVat,
        netVatAmount: preview.proposed.netVatAmount,
        payableAmount: preview.proposed.payableAmount,
        receivableAmount: preview.proposed.receivableAmount,
        snapshot: snapshot as Prisma.InputJsonValue,
        filedAt: preview.settlement.filedAt,
        filingReferenceNo: preview.settlement.filingReferenceNo,
        notes,
      },
      create: {
        vatSettlementId: preview.settlement.id,
        returnNo: preview.proposed.returnNo,
        declarationDate,
        dueDate: preview.proposed.dueDate
          ? normalizeFinancialDate(preview.proposed.dueDate)
          : null,
        status: resolveVatReturnStatus(preview.settlement.filedAt),
        currencyCode: preview.proposed.currencyCode,
        outputTaxableBase: preview.proposed.outputTaxableBase,
        outputVat: preview.proposed.outputVat,
        inputTaxableBase: preview.proposed.inputTaxableBase,
        inputVat: preview.proposed.inputVat,
        manualOutputVat: preview.proposed.manualOutputVat,
        manualInputVat: preview.proposed.manualInputVat,
        netVatAmount: preview.proposed.netVatAmount,
        payableAmount: preview.proposed.payableAmount,
        receivableAmount: preview.proposed.receivableAmount,
        snapshot: snapshot as Prisma.InputJsonValue,
        filedAt: preview.settlement.filedAt,
        filingReferenceNo: preview.settlement.filingReferenceNo,
        notes,
        createdById: userId,
      },
      select: { id: true },
    });

    await this.auditLogs.log({
      userId,
      entityType: 'vat_returns',
      entityId: saved.id,
      action: preview.existingReturn ? 'UPDATE_RETURN' : 'GENERATE_RETURN',
      metadata: {
        returnNo: preview.proposed.returnNo,
        settlementId: preview.settlement.id,
        settlementNo: preview.settlement.settlementNo,
        periodKey: preview.period.key,
      },
    });

    return this.getOne(saved.id);
  }

  async fileReturn(id: string, dto: FileVatReturnDto, userId: string) {
    const current = await this.findReturnRow(id);
    const filedAt = normalizeFinancialDate(dto.filedAt ?? new Date());
    const filingReferenceNo =
      normalizeOptional(dto.filingReferenceNo) ?? current.filingReferenceNo ?? null;
    const notes = normalizeOptional(dto.notes) ?? current.notes ?? null;
    const mapped = this.mapReturn(current);
    const nextSnapshot = {
      ...mapped.snapshot,
      company: mapped.company,
      period: mapped.period,
      settlement: {
        ...mapped.settlement,
        filedAt,
        filingReferenceNo,
      },
      declaration: {
        boxes: mapped.declaration.boxes,
        metrics: mapped.declaration.metrics,
        statement: mapped.declaration.statement,
      },
      filing: {
        filedAt,
        filingReferenceNo,
      },
    };

    await this.vatSettlementsService.fileSettlement(
      current.vatSettlement.id,
      {
        filedAt: filedAt.toISOString().slice(0, 10),
        filingReferenceNo: filingReferenceNo ?? undefined,
        notes: notes ?? undefined,
      },
      userId,
    );

    await this.prisma.vatReturn.update({
      where: { id },
      data: {
        status: VatReturnStatus.FILED,
        filedAt,
        filingReferenceNo,
        notes,
        snapshot: nextSnapshot as Prisma.InputJsonValue,
      },
    });

    await this.auditLogs.log({
      userId,
      entityType: 'vat_returns',
      entityId: id,
      action: 'FILE_RETURN',
      metadata: {
        returnNo: current.returnNo,
        settlementNo: current.vatSettlement.settlementNo,
        filedAt: filedAt.toISOString(),
        filingReferenceNo,
      },
    });

    return this.getOne(id);
  }

  async getExportPayload(id: string) {
    return this.getOne(id);
  }

  async buildCsvExport(id: string) {
    const item = await this.getExportPayload(id);
    const rows = [
      csvRow(['Deklarata Mujore e TVSH-se', item.returnNo]),
      csvRow(['Periudha', item.period.label]),
      csvRow(['Data e deklarates', item.declarationDate.toISOString().slice(0, 10)]),
      csvRow(['Afati', item.dueDate ? item.dueDate.toISOString().slice(0, 10) : '']),
      csvRow(['Status', item.status]),
      csvRow(['Referenca e filing', item.filingReferenceNo ?? '']),
      csvRow([]),
      csvRow(['Kompania', item.company.name]),
      csvRow(['Nr. fiskal', item.company.fiscalNo ?? '']),
      csvRow(['Nr. TVSH', item.company.vatNo ?? '']),
      csvRow(['Adresa', item.company.address ?? '']),
      csvRow([]),
      csvRow(['Settlement', item.settlement.settlementNo]),
      csvRow(['Pagesa te regjistruara', item.settlement.paidAmount]),
      csvRow(['Detyrim i pambuluar', item.settlement.remainingPayableAmount]),
      csvRow([]),
      csvRow(['Kodi', 'Pershkrimi', 'Vlera']),
      ...item.declaration.boxes.map((box: any) =>
        csvRow([box.code, box.label, Number(box.value ?? 0).toFixed(2)]),
      ),
    ];

    return {
      filename: `${item.exports.baseName}.csv`,
      content: rows.join('\n'),
    };
  }

  async buildJsonExport(id: string) {
    const item = await this.getExportPayload(id);
    return {
      filename: `${item.exports.baseName}.json`,
      content: JSON.stringify(item, null, 2),
    };
  }

  async buildPdfExport(id: string) {
    const item = await this.getExportPayload(id);
    const buffer = await this.pdfService.generateVatReturnPdf(item);
    return {
      filename: `${item.exports.baseName}.pdf`,
      buffer,
    };
  }
}
