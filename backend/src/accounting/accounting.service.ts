import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FinanceAccountTransactionType,
  FinanceAccountType,
  FinanceSettlementType,
  DocumentStatus,
  JournalEntryLineSide,
  LedgerAccountCategory,
  LedgerAccountReportSection,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  formatFinancialPeriodLabel,
  getFinancialPeriodKey,
} from '../common/utils/financial-periods';
import { round2 } from '../common/utils/money';
import { toPaginatedResponse, toPagination } from '../common/utils/pagination';
import { FinancialPeriodsService } from '../financial-periods/financial-periods.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  SYSTEM_LEDGER_ACCOUNT_CODES,
  SYSTEM_LEDGER_ACCOUNTS,
} from './accounting.constants';
import {
  calculateNetBySide,
  calculateStatementAmount,
  isBalanceSheetSection,
  isProfitLossSection,
} from './accounting.utils';
import { AccountingReportQueryDto } from './dto/accounting-report-query.dto';
import { ClosingEntryDto } from './dto/closing-entry.dto';
import { CreateManualJournalEntryDto } from './dto/create-manual-journal-entry.dto';
import { ListJournalEntriesQueryDto } from './dto/list-journal-entries-query.dto';
import { ListLedgerAccountsQueryDto } from './dto/list-ledger-accounts-query.dto';
import { VatLedgerQueryDto } from './dto/vat-ledger-query.dto';

type TransactionClient = Prisma.TransactionClient;

type LedgerLineInput = {
  accountCode?: string;
  accountId?: string;
  side: JournalEntryLineSide;
  amount: number;
  description?: string | null;
  partyName?: string | null;
};

type JournalEntryInput = {
  entryDate: Date;
  description: string;
  sourceType?: string | null;
  sourceId?: string | null;
  sourceNo?: string | null;
  createdById: string;
  lines: LedgerLineInput[];
};

type LedgerTotals = {
  debit: number;
  credit: number;
};

const REPORT_SECTION_LABELS: Record<LedgerAccountReportSection, string> = {
  CURRENT_ASSET: 'Aktivet afatshkurtra',
  NON_CURRENT_ASSET: 'Aktivet afatgjata',
  CURRENT_LIABILITY: 'Detyrimet afatshkurtra',
  NON_CURRENT_LIABILITY: 'Detyrimet afatgjata',
  EQUITY: 'Kapitali',
  REVENUE: 'Te ardhurat',
  CONTRA_REVENUE: 'Zbritjet / Kthimet nga shitja',
  COST_OF_SALES: 'Kosto e shitjeve',
  OPERATING_EXPENSE: 'Shpenzime operative',
  OTHER_INCOME: 'Te ardhura te tjera',
  OTHER_EXPENSE: 'Shpenzime te tjera',
};

function normalizeDateOnly(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('Invalid accounting date');
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfYear(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
}

function sectionOrder(section: LedgerAccountReportSection) {
  const order: Record<LedgerAccountReportSection, number> = {
    CURRENT_ASSET: 10,
    NON_CURRENT_ASSET: 20,
    CURRENT_LIABILITY: 30,
    NON_CURRENT_LIABILITY: 40,
    EQUITY: 50,
    REVENUE: 60,
    CONTRA_REVENUE: 70,
    COST_OF_SALES: 80,
    OPERATING_EXPENSE: 90,
    OTHER_INCOME: 100,
    OTHER_EXPENSE: 110,
  };

  return order[section] ?? 999;
}

@Injectable()
export class AccountingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financialPeriodsService: FinancialPeriodsService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  private getClient(tx?: TransactionClient) {
    return tx ?? this.prisma;
  }

  private buildAccountWhere(query: ListLedgerAccountsQueryDto): Prisma.LedgerAccountWhereInput {
    const search = query.search?.trim();

    return {
      category: query.category as LedgerAccountCategory | undefined,
      reportSection: query.reportSection as LedgerAccountReportSection | undefined,
      isActive:
        typeof query.isActive === 'string' ? query.isActive === 'true' : undefined,
      allowManual:
        typeof query.allowManual === 'string' ? query.allowManual === 'true' : undefined,
      OR: search
        ? [
            { code: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ]
        : undefined,
    };
  }

  private buildJournalWhere(
    query: ListJournalEntriesQueryDto,
  ): Prisma.JournalEntryWhereInput {
    const search = query.search?.trim();

    return {
      entryDate:
        query.dateFrom || query.dateTo
          ? {
              gte: query.dateFrom ? normalizeDateOnly(query.dateFrom) : undefined,
              lte: query.dateTo ? normalizeDateOnly(query.dateTo) : undefined,
            }
          : undefined,
      sourceType: query.sourceType?.trim() || undefined,
      lines: query.accountId ? { some: { accountId: query.accountId } } : undefined,
      OR: search
        ? [
            { entryNo: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { sourceNo: { contains: search, mode: 'insensitive' } },
            {
              lines: {
                some: {
                  account: {
                    OR: [
                      { code: { contains: search, mode: 'insensitive' } },
                      { name: { contains: search, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            },
          ]
        : undefined,
    };
  }

  private resolveAccountOrder(
    sortBy?: string,
    sortOrder: 'asc' | 'desc' = 'asc',
  ): Prisma.LedgerAccountOrderByWithRelationInput[] {
    switch (sortBy) {
      case 'code':
        return [{ code: sortOrder }];
      case 'name':
        return [{ name: sortOrder }];
      case 'category':
        return [{ category: sortOrder }, { sortOrder: 'asc' }, { code: 'asc' }];
      case 'reportSection':
        return [{ reportSection: sortOrder }, { sortOrder: 'asc' }, { code: 'asc' }];
      default:
        return [{ sortOrder: 'asc' }, { code: 'asc' }];
    }
  }

  private resolveJournalOrder(
    sortBy?: string,
    sortOrder: 'asc' | 'desc' = 'desc',
  ): Prisma.JournalEntryOrderByWithRelationInput[] {
    switch (sortBy) {
      case 'entryNo':
        return [{ entryNo: sortOrder }];
      case 'createdAt':
        return [{ createdAt: sortOrder }];
      case 'sourceNo':
        return [{ sourceNo: sortOrder }, { entryDate: sortOrder }];
      default:
        return [{ entryDate: sortOrder }, { createdAt: sortOrder }];
    }
  }

  private async buildTotalsByAccount(
    client: PrismaService | TransactionClient,
    params?: {
      accountIds?: string[];
      dateFrom?: Date | null;
      dateTo?: Date | null;
      beforeDate?: Date | null;
      includeSourceTypes?: string[];
      excludeSourceTypes?: string[];
    },
  ) {
    const lines = await client.journalEntryLine.findMany({
      where: {
        accountId: params?.accountIds?.length ? { in: params.accountIds } : undefined,
        journalEntry: {
          ...(params?.beforeDate
            ? { entryDate: { lt: params.beforeDate } }
            : params?.dateFrom || params?.dateTo
              ? {
                  entryDate: {
                    gte: params.dateFrom ?? undefined,
                    lte: params.dateTo ?? undefined,
                  },
                }
              : {}),
          ...(params?.includeSourceTypes?.length
            ? { sourceType: { in: params.includeSourceTypes } }
            : {}),
          ...(params?.excludeSourceTypes?.length
            ? { sourceType: { notIn: params.excludeSourceTypes } }
            : {}),
        },
      },
      select: {
        accountId: true,
        side: true,
        amount: true,
      },
    });

    const totals = new Map<string, LedgerTotals>();

    for (const line of lines) {
      const entry = totals.get(line.accountId) ?? { debit: 0, credit: 0 };
      if (line.side === JournalEntryLineSide.DEBIT) {
        entry.debit = round2(entry.debit + Number(line.amount ?? 0));
      } else {
        entry.credit = round2(entry.credit + Number(line.amount ?? 0));
      }
      totals.set(line.accountId, entry);
    }

    return totals;
  }

  private buildStatementSections(params: {
    items: Array<{
      accountId: string;
      accountCode: string;
      accountName: string;
      reportSection: LedgerAccountReportSection;
      category: LedgerAccountCategory;
      amount: number;
      debit: number;
      credit: number;
    }>;
  }) {
    const groups = new Map<
      LedgerAccountReportSection,
      {
        section: LedgerAccountReportSection;
        label: string;
        total: number;
        items: Array<{
          accountId: string;
          accountCode: string;
          accountName: string;
          category: LedgerAccountCategory;
          amount: number;
          debit: number;
          credit: number;
        }>;
      }
    >();

    for (const item of params.items) {
      const existing =
        groups.get(item.reportSection) ??
        {
          section: item.reportSection,
          label: REPORT_SECTION_LABELS[item.reportSection],
          total: 0,
          items: [],
        };

      existing.total = round2(existing.total + item.amount);
      existing.items.push({
        accountId: item.accountId,
        accountCode: item.accountCode,
        accountName: item.accountName,
        category: item.category,
        amount: item.amount,
        debit: item.debit,
        credit: item.credit,
      });
      groups.set(item.reportSection, existing);
    }

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        items: group.items.sort((left, right) =>
          left.accountCode.localeCompare(right.accountCode, 'sq'),
        ),
      }))
      .sort((left, right) => sectionOrder(left.section) - sectionOrder(right.section));
  }

  private async nextEntryNoTx(client: PrismaService | TransactionClient, entryDate: Date) {
    const year = entryDate.getUTCFullYear();
    const month = entryDate.getUTCMonth() + 1;
    const prefix = `JE-${year}${String(month).padStart(2, '0')}-`;
    const count = await client.journalEntry.count({
      where: { year, month },
    });

    return `${prefix}${String(count + 1).padStart(6, '0')}`;
  }

  private async resolveLedgerAccountIdTx(
    client: PrismaService | TransactionClient,
    line: LedgerLineInput,
  ) {
    if (line.accountId) {
      return line.accountId;
    }

    if (!line.accountCode) {
      throw new BadRequestException('Ledger line must contain accountCode or accountId');
    }

    const account = await client.ledgerAccount.findUnique({
      where: { code: line.accountCode },
      select: { id: true },
    });

    if (!account) {
      throw new BadRequestException(`Ledger account ${line.accountCode} not found`);
    }

    return account.id;
  }

  private async buildJournalLinesTx(
    client: PrismaService | TransactionClient,
    lines: LedgerLineInput[],
  ) {
    const normalized = lines
      .map((line) => ({
        ...line,
        amount: round2(Number(line.amount ?? 0)),
      }))
      .filter((line) => line.amount > 0);

    const debitTotal = round2(
      normalized
        .filter((line) => line.side === JournalEntryLineSide.DEBIT)
        .reduce((sum, line) => sum + line.amount, 0),
    );
    const creditTotal = round2(
      normalized
        .filter((line) => line.side === JournalEntryLineSide.CREDIT)
        .reduce((sum, line) => sum + line.amount, 0),
    );

    if (!normalized.length) {
      throw new BadRequestException('Journal entry requires at least one positive line');
    }

    if (round2(debitTotal - creditTotal) !== 0) {
      throw new BadRequestException('Journal entry is not balanced');
    }

    const resolved = [];
    for (let index = 0; index < normalized.length; index += 1) {
      const line = normalized[index];
      const accountId = await this.resolveLedgerAccountIdTx(client, line);
      resolved.push({
        accountId,
        lineNo: index + 1,
        side: line.side,
        amount: line.amount,
        description: line.description?.trim() || null,
        partyName: line.partyName?.trim() || null,
      });
    }

    return resolved;
  }

  private async upsertJournalEntryTx(
    tx: TransactionClient,
    params: JournalEntryInput,
  ) {
    await this.ensureChartOfAccountsTx(tx);
    const entryDate = normalizeDateOnly(params.entryDate);
    const year = entryDate.getUTCFullYear();
    const month = entryDate.getUTCMonth() + 1;
    const lines = await this.buildJournalLinesTx(tx, params.lines);

    const existing =
      params.sourceType && params.sourceId
        ? await tx.journalEntry.findFirst({
            where: {
              sourceType: params.sourceType,
              sourceId: params.sourceId,
            },
            select: { id: true, entryNo: true },
          })
        : null;

    if (existing) {
      await tx.journalEntryLine.deleteMany({
        where: { journalEntryId: existing.id },
      });

      return tx.journalEntry.update({
        where: { id: existing.id },
        data: {
          entryDate,
          year,
          month,
          description: params.description,
          sourceType: params.sourceType?.trim() || null,
          sourceId: params.sourceId ?? null,
          sourceNo: params.sourceNo?.trim() || null,
          createdById: params.createdById,
          lines: {
            createMany: {
              data: lines,
            },
          },
        },
        include: {
          createdBy: { select: { id: true, fullName: true, email: true } },
          lines: {
            include: {
              account: true,
            },
            orderBy: { lineNo: 'asc' },
          },
        },
      });
    }

    const entryNo = await this.nextEntryNoTx(tx, entryDate);
    return tx.journalEntry.create({
      data: {
        entryNo,
        entryDate,
        year,
        month,
        description: params.description,
        sourceType: params.sourceType?.trim() || null,
        sourceId: params.sourceId ?? null,
        sourceNo: params.sourceNo?.trim() || null,
        createdById: params.createdById,
        lines: {
          createMany: {
            data: lines,
          },
        },
      },
      include: {
        createdBy: { select: { id: true, fullName: true, email: true } },
        lines: {
          include: {
            account: true,
          },
          orderBy: { lineNo: 'asc' },
        },
      },
    });
  }

  async ensureChartOfAccounts() {
    await this.ensureChartOfAccountsTx(this.prisma);
  }

  async ensureChartOfAccountsTx(tx: TransactionClient | PrismaService) {
    for (const account of SYSTEM_LEDGER_ACCOUNTS) {
      await tx.ledgerAccount.upsert({
        where: { code: account.code },
        update: {
          name: account.name,
          category: account.category,
          reportSection: account.reportSection,
          isSystem: true,
          isActive: true,
          allowManual: account.allowManual ?? false,
          sortOrder: account.sortOrder,
          description: account.description,
        },
        create: {
          code: account.code,
          name: account.name,
          category: account.category,
          reportSection: account.reportSection,
          isSystem: true,
          isActive: true,
          allowManual: account.allowManual ?? false,
          sortOrder: account.sortOrder,
          description: account.description,
        },
      });
    }

    const financeAccounts = await tx.financeAccount.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        accountType: true,
        ledgerAccountId: true,
        isActive: true,
        notes: true,
      },
    });

    for (const financeAccount of financeAccounts) {
      const ledgerAccount = await tx.ledgerAccount.upsert({
        where: { code: financeAccount.code },
        update: {
          name: financeAccount.name,
          category: LedgerAccountCategory.ASSET,
          reportSection: LedgerAccountReportSection.CURRENT_ASSET,
          isSystem: true,
          isActive: financeAccount.isActive,
          allowManual: false,
          sortOrder: financeAccount.accountType === FinanceAccountType.CASH ? 1010 : 1020,
          description: financeAccount.notes?.trim() || null,
        },
        create: {
          code: financeAccount.code,
          name: financeAccount.name,
          category: LedgerAccountCategory.ASSET,
          reportSection: LedgerAccountReportSection.CURRENT_ASSET,
          isSystem: true,
          isActive: financeAccount.isActive,
          allowManual: false,
          sortOrder: financeAccount.accountType === FinanceAccountType.CASH ? 1010 : 1020,
          description: financeAccount.notes?.trim() || null,
        },
      });

      if (financeAccount.ledgerAccountId !== ledgerAccount.id) {
        await tx.financeAccount.update({
          where: { id: financeAccount.id },
          data: {
            ledgerAccountId: ledgerAccount.id,
          },
        });
      }
    }
  }

  async listAccounts(query: ListLedgerAccountsQueryDto = {}) {
    await this.ensureChartOfAccounts();

    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.max(query.limit ?? 20, 1);
    const { skip, take } = toPagination(page, limit);
    const where = this.buildAccountWhere(query);

    const [items, total, allMatching] = await this.prisma.$transaction([
      this.prisma.ledgerAccount.findMany({
        where,
        include: {
          financeAccounts: {
            select: {
              id: true,
              code: true,
              name: true,
              accountType: true,
            },
          },
        },
        orderBy: this.resolveAccountOrder(query.sortBy, query.sortOrder === 'desc' ? 'desc' : 'asc'),
        skip,
        take,
      }),
      this.prisma.ledgerAccount.count({ where }),
      this.prisma.ledgerAccount.findMany({
        where,
        select: {
          id: true,
          category: true,
          reportSection: true,
          isActive: true,
        },
      }),
    ]);

    const totals = await this.buildTotalsByAccount(this.prisma, {
      accountIds: items.map((account) => account.id),
    });

    const mappedItems = items.map((account) => {
      const entry = totals.get(account.id) ?? { debit: 0, credit: 0 };
      return {
        ...account,
        debitTotal: entry.debit,
        creditTotal: entry.credit,
        balance: calculateStatementAmount({
          reportSection: account.reportSection,
          debit: entry.debit,
          credit: entry.credit,
        }),
        reportSectionLabel: REPORT_SECTION_LABELS[account.reportSection],
      };
    });

    return {
      ...toPaginatedResponse({
        items: mappedItems,
        total,
        page,
        limit,
      }),
      summary: {
        accountCount: allMatching.length,
        activeCount: allMatching.filter((account) => account.isActive).length,
        inactiveCount: allMatching.filter((account) => !account.isActive).length,
        byCategory: Object.values(LedgerAccountCategory).map((category) => ({
          category,
          count: allMatching.filter((account) => account.category === category).length,
        })),
        bySection: Object.values(LedgerAccountReportSection).map((section) => ({
          section,
          label: REPORT_SECTION_LABELS[section],
          count: allMatching.filter((account) => account.reportSection === section).length,
        })),
      },
    };
  }

  async listJournalEntries(query: ListJournalEntriesQueryDto = {}) {
    await this.ensureChartOfAccounts();

    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.max(query.limit ?? 20, 1);
    const { skip, take } = toPagination(page, limit);
    const where = this.buildJournalWhere(query);
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

    const [items, total] = await this.prisma.$transaction([
      this.prisma.journalEntry.findMany({
        where,
        include: {
          createdBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          lines: {
            include: {
              account: true,
            },
            orderBy: { lineNo: 'asc' },
          },
        },
        orderBy: this.resolveJournalOrder(query.sortBy, sortOrder),
        skip,
        take,
      }),
      this.prisma.journalEntry.count({ where }),
    ]);

    const mappedItems = items.map((entry) => {
      const debitTotal = round2(
        entry.lines
          .filter((line) => line.side === JournalEntryLineSide.DEBIT)
          .reduce((sum, line) => sum + Number(line.amount ?? 0), 0),
      );
      const creditTotal = round2(
        entry.lines
          .filter((line) => line.side === JournalEntryLineSide.CREDIT)
          .reduce((sum, line) => sum + Number(line.amount ?? 0), 0),
      );

      return {
        ...entry,
        debitTotal,
        creditTotal,
      };
    });

    return {
      ...toPaginatedResponse({
        items: mappedItems,
        total,
        page,
        limit,
      }),
      summary: {
        count: total,
        visibleCount: mappedItems.length,
        visibleDebitTotal: round2(
          mappedItems.reduce((sum, item) => sum + item.debitTotal, 0),
        ),
        visibleCreditTotal: round2(
          mappedItems.reduce((sum, item) => sum + item.creditTotal, 0),
        ),
      },
    };
  }

  async createManualJournalEntry(dto: CreateManualJournalEntryDto, userId: string) {
    await this.ensureChartOfAccounts();

    const entryDate = normalizeDateOnly(dto.entryDate);
    const description = dto.description?.trim();
    const sourceNo = dto.sourceNo?.trim() || null;

    if (!description) {
      throw new BadRequestException('Pershkrimi i journal entry eshte i detyrueshem');
    }

    await this.financialPeriodsService.assertDateOpen(
      entryDate,
      userId,
      'Journal entry manuale',
    );

    const accountIds = Array.from(new Set(dto.lines.map((line) => line.accountId)));
    const accounts = await this.prisma.ledgerAccount.findMany({
      where: {
        id: { in: accountIds },
      },
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
        allowManual: true,
      },
    });

    if (accounts.length !== accountIds.length) {
      throw new BadRequestException('Nje ose me shume konto nuk u gjeten ne ledger');
    }

    const accountMap = new Map(accounts.map((account) => [account.id, account]));
    for (const line of dto.lines) {
      const account = accountMap.get(line.accountId);
      if (!account) {
        throw new BadRequestException('Nje ose me shume konto nuk u gjeten ne ledger');
      }
      if (!account.isActive) {
        throw new BadRequestException(
          `Konto ${account.code} - ${account.name} nuk eshte aktive per journal manual`,
        );
      }
      if (!account.allowManual) {
        throw new BadRequestException(
          `Konto ${account.code} - ${account.name} nuk lejon journal entries manuale`,
        );
      }
    }

    const entry = await this.prisma.$transaction((tx) =>
      this.upsertJournalEntryTx(tx, {
        entryDate,
        description,
        sourceType: 'MANUAL_JOURNAL',
        sourceId: randomUUID(),
        sourceNo,
        createdById: userId,
        lines: dto.lines.map((line) => ({
          accountId: line.accountId,
          side:
            line.side === 'DEBIT'
              ? JournalEntryLineSide.DEBIT
              : JournalEntryLineSide.CREDIT,
          amount: round2(Number(line.amount ?? 0)),
          description: line.description?.trim() || null,
          partyName: line.partyName?.trim() || null,
        })),
      }),
    );

    const debitTotal = round2(
      entry.lines
        .filter((line) => line.side === JournalEntryLineSide.DEBIT)
        .reduce((sum, line) => sum + Number(line.amount ?? 0), 0),
    );
    const creditTotal = round2(
      entry.lines
        .filter((line) => line.side === JournalEntryLineSide.CREDIT)
        .reduce((sum, line) => sum + Number(line.amount ?? 0), 0),
    );

    await this.auditLogs.log({
      userId,
      entityType: 'journal_entries',
      entityId: entry.id,
      action: 'CREATE_MANUAL_JOURNAL',
      metadata: {
        entryNo: entry.entryNo,
        entryDate,
        sourceNo,
        debitTotal,
        creditTotal,
        lineCount: entry.lines.length,
      },
    });

    return {
      ...entry,
      debitTotal,
      creditTotal,
    };
  }

  private async resolveClosingEntryPreview(financialPeriodId: string) {
    await this.ensureChartOfAccounts();

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

    const [accounts, retainedEarnings, periodSummary, existingEntry] = await Promise.all([
      this.prisma.ledgerAccount.findMany({
        where: {
          isActive: true,
          reportSection: {
            in: Object.values(LedgerAccountReportSection).filter((section) =>
              isProfitLossSection(section),
            ),
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      }),
      this.prisma.ledgerAccount.findUnique({
        where: { code: SYSTEM_LEDGER_ACCOUNT_CODES.retainedEarnings },
        select: {
          id: true,
          code: true,
          name: true,
        },
      }),
      this.financialPeriodsService.getSummary(financialPeriodId),
      this.prisma.journalEntry.findFirst({
        where: {
          sourceType: 'PERIOD_CLOSE',
          sourceId: financialPeriodId,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          lines: {
            include: {
              account: true,
            },
            orderBy: { lineNo: 'asc' },
          },
        },
      }),
    ]);

    if (!retainedEarnings) {
      throw new BadRequestException('Konto e fitimit te mbartur mungon ne chart of accounts');
    }

    const periodTotals = await this.buildTotalsByAccount(this.prisma, {
      accountIds: accounts.map((account) => account.id),
      dateFrom: normalizeDateOnly(period.periodStart),
      dateTo: normalizeDateOnly(period.periodEnd),
      excludeSourceTypes: ['PERIOD_CLOSE'],
    });

    const profitLossItems = accounts
      .map((account) => {
        const totals = periodTotals.get(account.id) ?? { debit: 0, credit: 0 };
        const amount = calculateStatementAmount({
          reportSection: account.reportSection,
          debit: totals.debit,
          credit: totals.credit,
        });
        return {
          accountId: account.id,
          accountCode: account.code,
          accountName: account.name,
          category: account.category,
          reportSection: account.reportSection,
          reportSectionLabel: REPORT_SECTION_LABELS[account.reportSection],
          amount,
          debit: totals.debit,
          credit: totals.credit,
        };
      })
      .filter((item) => item.debit > 0 || item.credit > 0 || item.amount !== 0);

    const sections = this.buildStatementSections({ items: profitLossItems });
    const totalBySection = (section: LedgerAccountReportSection) =>
      round2(
        sections
          .filter((entry) => entry.section === section)
          .reduce((sum, entry) => sum + entry.total, 0),
      );

    const revenue = totalBySection(LedgerAccountReportSection.REVENUE);
    const contraRevenue = totalBySection(LedgerAccountReportSection.CONTRA_REVENUE);
    const costOfSales = totalBySection(LedgerAccountReportSection.COST_OF_SALES);
    const operatingExpenses = totalBySection(
      LedgerAccountReportSection.OPERATING_EXPENSE,
    );
    const otherIncome = totalBySection(LedgerAccountReportSection.OTHER_INCOME);
    const otherExpense = totalBySection(LedgerAccountReportSection.OTHER_EXPENSE);
    const netRevenue = round2(revenue - contraRevenue);
    const grossProfit = round2(netRevenue - costOfSales);
    const operatingResult = round2(grossProfit - operatingExpenses);
    const netProfit = round2(operatingResult + otherIncome - otherExpense);

    const lines = profitLossItems
      .map((item) => {
        const net = calculateNetBySide({
          debit: item.debit,
          credit: item.credit,
        });
        if (net.debitBalance > 0) {
          return {
            accountId: item.accountId,
            accountCode: item.accountCode,
            accountName: item.accountName,
            reportSection: item.reportSection,
            reportSectionLabel: item.reportSectionLabel,
            side: JournalEntryLineSide.CREDIT,
            amount: net.debitBalance,
          };
        }
        if (net.creditBalance > 0) {
          return {
            accountId: item.accountId,
            accountCode: item.accountCode,
            accountName: item.accountName,
            reportSection: item.reportSection,
            reportSectionLabel: item.reportSectionLabel,
            side: JournalEntryLineSide.DEBIT,
            amount: net.creditBalance,
          };
        }
        return null;
      })
      .filter(
        (
          line,
        ): line is {
          accountId: string;
          accountCode: string;
          accountName: string;
          reportSection: LedgerAccountReportSection;
          reportSectionLabel: string;
          side: JournalEntryLineSide;
          amount: number;
        } => Boolean(line && line.amount > 0),
      );

    const debitTotal = round2(
      lines
        .filter((line) => line.side === JournalEntryLineSide.DEBIT)
        .reduce((sum, line) => sum + line.amount, 0),
    );
    const creditTotal = round2(
      lines
        .filter((line) => line.side === JournalEntryLineSide.CREDIT)
        .reduce((sum, line) => sum + line.amount, 0),
    );
    const difference = round2(debitTotal - creditTotal);

    const offsetLine =
      difference === 0
        ? null
        : {
            accountId: retainedEarnings.id,
            accountCode: retainedEarnings.code,
            accountName: retainedEarnings.name,
            reportSection: LedgerAccountReportSection.EQUITY,
            reportSectionLabel: REPORT_SECTION_LABELS[LedgerAccountReportSection.EQUITY],
            side:
              difference > 0
                ? JournalEntryLineSide.CREDIT
                : JournalEntryLineSide.DEBIT,
            amount: Math.abs(difference),
          };

    const previewLines = offsetLine ? [...lines, offsetLine] : lines;

    const existingEntrySummary = existingEntry
      ? {
          id: existingEntry.id,
          entryNo: existingEntry.entryNo,
          entryDate: existingEntry.entryDate,
          description: existingEntry.description,
          sourceNo: existingEntry.sourceNo,
          createdAt: existingEntry.createdAt,
          updatedAt: existingEntry.updatedAt,
          createdBy: existingEntry.createdBy,
          lines: existingEntry.lines,
          debitTotal: round2(
            existingEntry.lines
              .filter((line) => line.side === JournalEntryLineSide.DEBIT)
              .reduce((sum, line) => sum + Number(line.amount ?? 0), 0),
          ),
          creditTotal: round2(
            existingEntry.lines
              .filter((line) => line.side === JournalEntryLineSide.CREDIT)
              .reduce((sum, line) => sum + Number(line.amount ?? 0), 0),
          ),
        }
      : null;

    return {
      period: {
        id: period.id,
        key: getFinancialPeriodKey(period.year, period.month),
        label: formatFinancialPeriodLabel(period.year, period.month),
        year: period.year,
        month: period.month,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        status: period.status,
      },
      summary: {
        revenue,
        contraRevenue,
        netRevenue,
        costOfSales,
        grossProfit,
        operatingExpenses,
        operatingResult,
        otherIncome,
        otherExpense,
        netProfit,
      },
      checklist: periodSummary.checklist,
      controlsSummary: periodSummary.summary,
      lines: previewLines,
      sourceLines: lines,
      offsetLine,
      totals: {
        debitTotal: round2(
          previewLines
            .filter((line) => line.side === JournalEntryLineSide.DEBIT)
            .reduce((sum, line) => sum + line.amount, 0),
        ),
        creditTotal: round2(
          previewLines
            .filter((line) => line.side === JournalEntryLineSide.CREDIT)
            .reduce((sum, line) => sum + line.amount, 0),
        ),
        lineCount: previewLines.length,
      },
      existingEntry: existingEntrySummary,
    };
  }

  async getClosingEntryPreview(financialPeriodId: string) {
    return this.resolveClosingEntryPreview(financialPeriodId);
  }

  async createClosingEntry(dto: ClosingEntryDto, userId: string) {
    const preview = await this.resolveClosingEntryPreview(dto.financialPeriodId);
    const description =
      dto.description?.trim() || `Mbyllje kontabel ${preview.period.label}`;

    if (preview.lines.length === 0) {
      throw new BadRequestException(
        'Nuk ka levizje profit/loss per kete periudhe qe te gjenerohet closing entry',
      );
    }

    await this.financialPeriodsService.assertDateOpen(
      preview.period.periodEnd,
      userId,
      `Mbyllja kontabel per ${preview.period.label}`,
    );

    const entry = await this.prisma.$transaction((tx) =>
      this.upsertJournalEntryTx(tx, {
        entryDate: preview.period.periodEnd,
        description,
        sourceType: 'PERIOD_CLOSE',
        sourceId: preview.period.id,
        sourceNo: `CLOSE-${preview.period.key}`,
        createdById: userId,
        lines: preview.lines.map((line) => ({
          accountId: line.accountId,
          side: line.side,
          amount: line.amount,
          description,
        })),
      }),
    );

    await this.auditLogs.log({
      userId,
      entityType: 'journal_entries',
      entityId: entry.id,
      action: 'CREATE_PERIOD_CLOSE',
      metadata: {
        entryNo: entry.entryNo,
        periodId: preview.period.id,
        periodKey: preview.period.key,
        blockerCount: preview.checklist.blockerCount,
        debitTotal: preview.totals.debitTotal,
        creditTotal: preview.totals.creditTotal,
        netProfit: preview.summary.netProfit,
      },
    });

    return {
      entry,
      preview,
    };
  }

  async getVatLedger(query: VatLedgerQueryDto = {}) {
    await this.ensureChartOfAccounts();

    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.max(query.limit ?? 20, 1);
    const { skip, take } = toPagination(page, limit);
    const dateTo = normalizeDateOnly(query.dateTo ?? new Date());
    const dateFrom = normalizeDateOnly(query.dateFrom ?? startOfYear(dateTo));
    const side = query.side ?? 'ALL';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
    const search = query.search?.trim().toLocaleLowerCase('sq');

    const postedDocumentStatuses = [
      DocumentStatus.POSTED,
      DocumentStatus.PARTIALLY_RETURNED,
      DocumentStatus.FULLY_RETURNED,
    ];

    const [salesInvoices, salesReturns, purchaseInvoices, manualVatEntries] =
      await this.prisma.$transaction([
        this.prisma.salesInvoice.findMany({
          where: {
            status: { in: postedDocumentStatuses },
            docDate: { gte: dateFrom, lte: dateTo },
          },
          select: {
            id: true,
            docNo: true,
            docDate: true,
            customer: {
              select: {
                id: true,
                name: true,
              },
            },
            lines: {
              select: {
                netAmount: true,
                taxAmount: true,
              },
            },
          },
        }),
        this.prisma.salesReturn.findMany({
          where: {
            status: DocumentStatus.POSTED,
            docDate: { gte: dateFrom, lte: dateTo },
          },
          select: {
            id: true,
            docNo: true,
            docDate: true,
            customer: {
              select: {
                id: true,
                name: true,
              },
            },
            lines: {
              select: {
                netAmount: true,
                taxAmount: true,
              },
            },
          },
        }),
        this.prisma.purchaseInvoice.findMany({
          where: {
            status: { in: postedDocumentStatuses },
            docDate: { gte: dateFrom, lte: dateTo },
          },
          select: {
            id: true,
            docNo: true,
            docDate: true,
            supplier: {
              select: {
                id: true,
                name: true,
              },
            },
            lines: {
              select: {
                netAmount: true,
                taxAmount: true,
              },
            },
          },
        }),
        this.prisma.journalEntry.findMany({
          where: {
            entryDate: { gte: dateFrom, lte: dateTo },
            sourceType: {
              notIn: ['SALES_INVOICE', 'PURCHASE_INVOICE', 'SALES_RETURN', 'PERIOD_CLOSE'],
            },
            lines: {
              some: {
                account: {
                  code: {
                    in: [
                      SYSTEM_LEDGER_ACCOUNT_CODES.vatInput,
                      SYSTEM_LEDGER_ACCOUNT_CODES.vatOutput,
                    ],
                  },
                },
              },
            },
          },
          include: {
            lines: {
              include: {
                account: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                  },
                },
              },
              orderBy: { lineNo: 'asc' },
            },
            createdBy: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        }),
      ]);

    const items = [
      ...salesInvoices.map((invoice) => ({
        id: `sales-${invoice.id}`,
        side: 'OUTPUT' as const,
        entryKind: 'SALES_INVOICE',
        docNo: invoice.docNo,
        docDate: invoice.docDate,
        partyName: invoice.customer?.name ?? null,
        taxableBase: round2(
          invoice.lines.reduce((sum, line) => sum + Number(line.netAmount ?? 0), 0),
        ),
        vatAmount: round2(
          invoice.lines.reduce((sum, line) => sum + Number(line.taxAmount ?? 0), 0),
        ),
        sourceNo: invoice.docNo,
        description: `Fature shitje ${invoice.docNo}`,
      })),
      ...salesReturns.map((salesReturn) => ({
        id: `sales-return-${salesReturn.id}`,
        side: 'OUTPUT' as const,
        entryKind: 'SALES_RETURN',
        docNo: salesReturn.docNo,
        docDate: salesReturn.docDate,
        partyName: salesReturn.customer?.name ?? null,
        taxableBase: round2(
          -salesReturn.lines.reduce((sum, line) => sum + Number(line.netAmount ?? 0), 0),
        ),
        vatAmount: round2(
          -salesReturn.lines.reduce((sum, line) => sum + Number(line.taxAmount ?? 0), 0),
        ),
        sourceNo: salesReturn.docNo,
        description: `Kthim shitje ${salesReturn.docNo}`,
      })),
      ...purchaseInvoices.map((invoice) => ({
        id: `purchase-${invoice.id}`,
        side: 'INPUT' as const,
        entryKind: 'PURCHASE_INVOICE',
        docNo: invoice.docNo,
        docDate: invoice.docDate,
        partyName: invoice.supplier?.name ?? null,
        taxableBase: round2(
          invoice.lines.reduce((sum, line) => sum + Number(line.netAmount ?? 0), 0),
        ),
        vatAmount: round2(
          invoice.lines.reduce((sum, line) => sum + Number(line.taxAmount ?? 0), 0),
        ),
        sourceNo: invoice.docNo,
        description: `Fature blerje ${invoice.docNo}`,
      })),
      ...manualVatEntries.flatMap((entry) =>
        entry.lines
          .filter(
            (line) =>
              line.account.code === SYSTEM_LEDGER_ACCOUNT_CODES.vatInput ||
              line.account.code === SYSTEM_LEDGER_ACCOUNT_CODES.vatOutput,
          )
          .map((line) => {
            const isInput = line.account.code === SYSTEM_LEDGER_ACCOUNT_CODES.vatInput;
            const signedVat = isInput
              ? line.side === JournalEntryLineSide.DEBIT
                ? Number(line.amount ?? 0)
                : -Number(line.amount ?? 0)
              : line.side === JournalEntryLineSide.CREDIT
                ? Number(line.amount ?? 0)
                : -Number(line.amount ?? 0);

            return {
              id: `manual-vat-${entry.id}-${line.id}`,
              side: isInput ? ('INPUT' as const) : ('OUTPUT' as const),
              entryKind: entry.sourceType?.trim() || 'MANUAL_JOURNAL',
              docNo: entry.entryNo,
              docDate: entry.entryDate,
              partyName: line.partyName ?? null,
              taxableBase: 0,
              vatAmount: round2(signedVat),
              sourceNo: entry.sourceNo ?? null,
              description:
                line.description?.trim() ||
                entry.description ||
                `Journal ${entry.entryNo}`,
            };
          })
          .filter((row) => row.vatAmount !== 0),
      ),
    ]
      .filter((item) => side === 'ALL' || item.side === side)
      .filter((item) => {
        if (!search) return true;
        const haystack = [
          item.docNo,
          item.partyName,
          item.sourceNo,
          item.description,
          item.entryKind,
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase('sq');
        return haystack.includes(search);
      });

    const sortBy = query.sortBy?.trim() || 'docDate';
    items.sort((left, right) => {
      const direction = sortOrder === 'asc' ? 1 : -1;
      switch (sortBy) {
        case 'docNo':
          return direction * left.docNo.localeCompare(right.docNo, 'sq');
        case 'partyName':
          return direction * (left.partyName ?? '').localeCompare(right.partyName ?? '', 'sq');
        case 'vatAmount':
          return direction * (left.vatAmount - right.vatAmount);
        case 'taxableBase':
          return direction * (left.taxableBase - right.taxableBase);
        default:
          return direction * (left.docDate.getTime() - right.docDate.getTime());
      }
    });

    const pagedItems = items.slice(skip, skip + take);
    const outputRows = items.filter((item) => item.side === 'OUTPUT');
    const inputRows = items.filter((item) => item.side === 'INPUT');
    const manualRows = items.filter(
      (item) =>
        item.entryKind !== 'SALES_INVOICE' &&
        item.entryKind !== 'PURCHASE_INVOICE' &&
        item.entryKind !== 'SALES_RETURN',
    );

    return {
      ...toPaginatedResponse({
        items: pagedItems,
        total: items.length,
        page,
        limit,
      }),
      filters: {
        dateFrom,
        dateTo,
        side,
        search: query.search ?? null,
      },
      summary: {
        outputTaxableBase: round2(
          outputRows.reduce((sum, item) => sum + item.taxableBase, 0),
        ),
        outputVat: round2(outputRows.reduce((sum, item) => sum + item.vatAmount, 0)),
        inputTaxableBase: round2(
          inputRows.reduce((sum, item) => sum + item.taxableBase, 0),
        ),
        inputVat: round2(inputRows.reduce((sum, item) => sum + item.vatAmount, 0)),
        netVatPayable: round2(
          outputRows.reduce((sum, item) => sum + item.vatAmount, 0) -
            inputRows.reduce((sum, item) => sum + item.vatAmount, 0),
        ),
        documentCount: items.length,
        manualAdjustmentCount: manualRows.length,
      },
    };
  }

  async getTrialBalance(query: AccountingReportQueryDto = {}) {
    await this.ensureChartOfAccounts();

    const asOfDate = normalizeDateOnly(
      query.asOfDate ?? query.dateTo ?? new Date(),
    );
    const dateFrom = query.dateFrom ? normalizeDateOnly(query.dateFrom) : null;
    const includeZero = query.includeZero === true;

    const accounts = await this.prisma.ledgerAccount.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });

    const accountIds = accounts.map((account) => account.id);
    const [openingTotals, periodTotals, closingTotals] = await Promise.all([
      dateFrom
        ? this.buildTotalsByAccount(this.prisma, {
            accountIds,
            beforeDate: dateFrom,
          })
        : Promise.resolve(new Map<string, LedgerTotals>()),
      this.buildTotalsByAccount(this.prisma, {
        accountIds,
        dateFrom: dateFrom ?? undefined,
        dateTo: asOfDate,
      }),
      this.buildTotalsByAccount(this.prisma, {
        accountIds,
        dateTo: asOfDate,
      }),
    ]);

    const items = accounts
      .map((account) => {
        const opening = openingTotals.get(account.id) ?? { debit: 0, credit: 0 };
        const movement = periodTotals.get(account.id) ?? { debit: 0, credit: 0 };
        const closing = closingTotals.get(account.id) ?? { debit: 0, credit: 0 };
        const openingBalance = calculateStatementAmount({
          reportSection: account.reportSection,
          debit: opening.debit,
          credit: opening.credit,
        });
        const movementBalance = calculateStatementAmount({
          reportSection: account.reportSection,
          debit: movement.debit,
          credit: movement.credit,
        });
        const closingBalance = calculateStatementAmount({
          reportSection: account.reportSection,
          debit: closing.debit,
          credit: closing.credit,
        });

        const closingBySide = calculateNetBySide(closing);

        return {
          accountId: account.id,
          accountCode: account.code,
          accountName: account.name,
          category: account.category,
          reportSection: account.reportSection,
          reportSectionLabel: REPORT_SECTION_LABELS[account.reportSection],
          openingDebit: opening.debit,
          openingCredit: opening.credit,
          openingBalance,
          periodDebit: movement.debit,
          periodCredit: movement.credit,
          movementBalance,
          closingDebit: closing.debit,
          closingCredit: closing.credit,
          closingBalance,
          closingDebitBalance: closingBySide.debitBalance,
          closingCreditBalance: closingBySide.creditBalance,
        };
      })
      .filter(
        (item) =>
          includeZero ||
          item.periodDebit > 0 ||
          item.periodCredit > 0 ||
          item.closingDebitBalance > 0 ||
          item.closingCreditBalance > 0,
      );

    return {
      filters: {
        dateFrom,
        asOfDate,
        includeZero,
      },
      summary: {
        accountCount: items.length,
        totalPeriodDebit: round2(items.reduce((sum, item) => sum + item.periodDebit, 0)),
        totalPeriodCredit: round2(items.reduce((sum, item) => sum + item.periodCredit, 0)),
        totalClosingDebit: round2(
          items.reduce((sum, item) => sum + item.closingDebitBalance, 0),
        ),
        totalClosingCredit: round2(
          items.reduce((sum, item) => sum + item.closingCreditBalance, 0),
        ),
      },
      items,
    };
  }

  async getProfitAndLoss(query: AccountingReportQueryDto = {}) {
    await this.ensureChartOfAccounts();

    const endDate = normalizeDateOnly(query.dateTo ?? query.asOfDate ?? new Date());
    const startDate = normalizeDateOnly(query.dateFrom ?? startOfYear(endDate));
    const includeZero = query.includeZero === true;

    const accounts = await this.prisma.ledgerAccount.findMany({
      where: {
        isActive: true,
        reportSection: {
          in: Object.values(LedgerAccountReportSection).filter((section) =>
            isProfitLossSection(section),
          ),
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });

    const totals = await this.buildTotalsByAccount(this.prisma, {
      accountIds: accounts.map((account) => account.id),
      dateFrom: startDate,
      dateTo: endDate,
      excludeSourceTypes: ['PERIOD_CLOSE'],
    });

    const items = accounts
      .map((account) => {
        const period = totals.get(account.id) ?? { debit: 0, credit: 0 };
        const amount = calculateStatementAmount({
          reportSection: account.reportSection,
          debit: period.debit,
          credit: period.credit,
        });

        return {
          accountId: account.id,
          accountCode: account.code,
          accountName: account.name,
          category: account.category,
          reportSection: account.reportSection,
          amount,
          debit: period.debit,
          credit: period.credit,
        };
      })
      .filter((item) => includeZero || item.debit > 0 || item.credit > 0 || item.amount !== 0);

    const sections = this.buildStatementSections({ items });
    const totalBySection = (section: LedgerAccountReportSection) =>
      round2(
        sections
          .filter((entry) => entry.section === section)
          .reduce((sum, entry) => sum + entry.total, 0),
      );

    const revenue = totalBySection(LedgerAccountReportSection.REVENUE);
    const contraRevenue = totalBySection(LedgerAccountReportSection.CONTRA_REVENUE);
    const costOfSales = totalBySection(LedgerAccountReportSection.COST_OF_SALES);
    const operatingExpenses = totalBySection(
      LedgerAccountReportSection.OPERATING_EXPENSE,
    );
    const otherIncome = totalBySection(LedgerAccountReportSection.OTHER_INCOME);
    const otherExpense = totalBySection(LedgerAccountReportSection.OTHER_EXPENSE);
    const netRevenue = round2(revenue - contraRevenue);
    const grossProfit = round2(netRevenue - costOfSales);
    const operatingResult = round2(grossProfit - operatingExpenses);
    const netProfit = round2(operatingResult + otherIncome - otherExpense);

    return {
      filters: {
        dateFrom: startDate,
        dateTo: endDate,
        includeZero,
      },
      summary: {
        revenue,
        contraRevenue,
        netRevenue,
        costOfSales,
        grossProfit,
        operatingExpenses,
        operatingResult,
        otherIncome,
        otherExpense,
        netProfit,
      },
      sections,
    };
  }

  async getBalanceSheet(query: AccountingReportQueryDto = {}) {
    await this.ensureChartOfAccounts();

    const asOfDate = normalizeDateOnly(query.asOfDate ?? query.dateTo ?? new Date());
    const includeZero = query.includeZero === true;

    const accounts = await this.prisma.ledgerAccount.findMany({
      where: {
        isActive: true,
        reportSection: {
          in: Object.values(LedgerAccountReportSection).filter((section) =>
            isBalanceSheetSection(section),
          ),
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });

    const totals = await this.buildTotalsByAccount(this.prisma, {
      accountIds: accounts.map((account) => account.id),
      dateTo: asOfDate,
    });

    const items = accounts
      .map((account) => {
        const closing = totals.get(account.id) ?? { debit: 0, credit: 0 };
        const amount = calculateStatementAmount({
          reportSection: account.reportSection,
          debit: closing.debit,
          credit: closing.credit,
        });

        return {
          accountId: account.id,
          accountCode: account.code,
          accountName: account.name,
          category: account.category,
          reportSection: account.reportSection,
          amount,
          debit: closing.debit,
          credit: closing.credit,
        };
      })
      .filter((item) => includeZero || item.amount !== 0 || item.debit > 0 || item.credit > 0);

    const latestClosingEntry = await this.prisma.journalEntry.findFirst({
      where: {
        sourceType: 'PERIOD_CLOSE',
        entryDate: { lte: asOfDate },
      },
      orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
      select: {
        entryDate: true,
      },
    });

    let currentEarnings = 0;
    if (!latestClosingEntry) {
      const pnl = await this.getProfitAndLoss({
        dateFrom: '2000-01-01',
        dateTo: asOfDate.toISOString().slice(0, 10),
        includeZero: false,
      });
      currentEarnings = round2(Number(pnl.summary.netProfit ?? 0));
    } else {
      const nextDate = new Date(
        Date.UTC(
          latestClosingEntry.entryDate.getUTCFullYear(),
          latestClosingEntry.entryDate.getUTCMonth(),
          latestClosingEntry.entryDate.getUTCDate() + 1,
        ),
      );

      if (nextDate <= asOfDate) {
        const pnl = await this.getProfitAndLoss({
          dateFrom: nextDate.toISOString().slice(0, 10),
          dateTo: asOfDate.toISOString().slice(0, 10),
          includeZero: false,
        });
        currentEarnings = round2(Number(pnl.summary.netProfit ?? 0));
      }
    }

    const sections = this.buildStatementSections({ items });
    const equitySection = sections.find(
      (entry) => entry.section === LedgerAccountReportSection.EQUITY,
    );

    if (currentEarnings !== 0 || includeZero) {
      const syntheticLine = {
        accountId: 'synthetic-current-earnings',
        accountCode: 'CURRENT_EARNINGS',
        accountName: 'Fitimi / Humbja e akumuluar',
        category: LedgerAccountCategory.EQUITY,
        amount: currentEarnings,
        debit: currentEarnings < 0 ? Math.abs(currentEarnings) : 0,
        credit: currentEarnings > 0 ? currentEarnings : 0,
      };

      if (equitySection) {
        equitySection.total = round2(equitySection.total + currentEarnings);
        equitySection.items.push(syntheticLine);
        equitySection.items.sort((left, right) =>
          left.accountCode.localeCompare(right.accountCode, 'sq'),
        );
      } else {
        sections.push({
          section: LedgerAccountReportSection.EQUITY,
          label: REPORT_SECTION_LABELS[LedgerAccountReportSection.EQUITY],
          total: currentEarnings,
          items: [syntheticLine],
        });
      }
    }

    sections.sort((left, right) => sectionOrder(left.section) - sectionOrder(right.section));

    const totalBySection = (section: LedgerAccountReportSection) =>
      round2(
        sections
          .filter((entry) => entry.section === section)
          .reduce((sum, entry) => sum + entry.total, 0),
      );

    const totalAssets = round2(
      totalBySection(LedgerAccountReportSection.CURRENT_ASSET) +
        totalBySection(LedgerAccountReportSection.NON_CURRENT_ASSET),
    );
    const totalLiabilities = round2(
      totalBySection(LedgerAccountReportSection.CURRENT_LIABILITY) +
        totalBySection(LedgerAccountReportSection.NON_CURRENT_LIABILITY),
    );
    const totalEquity = round2(totalBySection(LedgerAccountReportSection.EQUITY));
    const totalLiabilitiesAndEquity = round2(totalLiabilities + totalEquity);

    return {
      filters: {
        asOfDate,
        includeZero,
      },
      summary: {
        totalAssets,
        totalLiabilities,
        totalEquity,
        totalLiabilitiesAndEquity,
        difference: round2(totalAssets - totalLiabilitiesAndEquity),
      },
      sections,
    };
  }

  async ensureFinanceAccountLedgerTx(
    tx: TransactionClient,
    params: {
      financeAccountId: string;
      code: string;
      name: string;
      accountType: FinanceAccountType;
      isActive?: boolean;
      notes?: string | null;
    },
  ) {
    await this.ensureChartOfAccountsTx(tx);

    const ledgerAccount = await tx.ledgerAccount.upsert({
      where: { code: params.code },
      update: {
        name: params.name,
        category: LedgerAccountCategory.ASSET,
        reportSection: LedgerAccountReportSection.CURRENT_ASSET,
        isSystem: true,
        isActive: params.isActive ?? true,
        allowManual: false,
        sortOrder: params.accountType === FinanceAccountType.CASH ? 1010 : 1020,
        description: params.notes?.trim() || null,
      },
      create: {
        code: params.code,
        name: params.name,
        category: LedgerAccountCategory.ASSET,
        reportSection: LedgerAccountReportSection.CURRENT_ASSET,
        isSystem: true,
        isActive: params.isActive ?? true,
        allowManual: false,
        sortOrder: params.accountType === FinanceAccountType.CASH ? 1010 : 1020,
        description: params.notes?.trim() || null,
      },
    });

    await tx.financeAccount.update({
      where: { id: params.financeAccountId },
      data: {
        ledgerAccountId: ledgerAccount.id,
      },
    });

    return ledgerAccount;
  }

  async postSalesInvoiceTx(
    tx: TransactionClient,
    params: {
      invoice: {
        id: string;
        docNo: string;
        docDate: Date;
        grandTotal: number | Prisma.Decimal;
        lines: {
          netAmount: number | Prisma.Decimal;
          taxAmount: number | Prisma.Decimal;
        }[];
        customer?: { name?: string | null } | null;
      };
      createdById: string;
      inventoryValue: number;
    },
  ) {
    const netTotal = round2(
      params.invoice.lines.reduce((sum, line) => sum + Number(line.netAmount ?? 0), 0),
    );
    const taxTotal = round2(
      params.invoice.lines.reduce((sum, line) => sum + Number(line.taxAmount ?? 0), 0),
    );
    const grossTotal = round2(Number(params.invoice.grandTotal ?? 0));
    const inventoryValue = round2(params.inventoryValue);
    const partyName = params.invoice.customer?.name ?? null;

    return this.upsertJournalEntryTx(tx, {
      entryDate: params.invoice.docDate,
      description: `Postimi i fatures se shitjes ${params.invoice.docNo}`,
      sourceType: 'SALES_INVOICE',
      sourceId: params.invoice.id,
      sourceNo: params.invoice.docNo,
      createdById: params.createdById,
      lines: [
        {
          accountCode: SYSTEM_LEDGER_ACCOUNT_CODES.accountsReceivable,
          side: JournalEntryLineSide.DEBIT,
          amount: grossTotal,
          partyName,
        },
        {
          accountCode: SYSTEM_LEDGER_ACCOUNT_CODES.salesRevenue,
          side: JournalEntryLineSide.CREDIT,
          amount: netTotal,
          partyName,
        },
        {
          accountCode: SYSTEM_LEDGER_ACCOUNT_CODES.vatOutput,
          side: JournalEntryLineSide.CREDIT,
          amount: taxTotal,
          partyName,
        },
        {
          accountCode: SYSTEM_LEDGER_ACCOUNT_CODES.costOfSales,
          side: JournalEntryLineSide.DEBIT,
          amount: inventoryValue,
          partyName,
        },
        {
          accountCode: SYSTEM_LEDGER_ACCOUNT_CODES.inventory,
          side: JournalEntryLineSide.CREDIT,
          amount: inventoryValue,
          partyName,
        },
      ],
    });
  }

  async postPurchaseInvoiceTx(
    tx: TransactionClient,
    params: {
      invoice: {
        id: string;
        docNo: string;
        docDate: Date;
        grandTotal: number | Prisma.Decimal;
        lines: {
          netAmount: number | Prisma.Decimal;
          taxAmount: number | Prisma.Decimal;
        }[];
        supplier?: { name?: string | null } | null;
      };
      createdById: string;
    },
  ) {
    const inventoryTotal = round2(
      params.invoice.lines.reduce((sum, line) => sum + Number(line.netAmount ?? 0), 0),
    );
    const taxTotal = round2(
      params.invoice.lines.reduce((sum, line) => sum + Number(line.taxAmount ?? 0), 0),
    );
    const grossTotal = round2(Number(params.invoice.grandTotal ?? 0));
    const partyName = params.invoice.supplier?.name ?? null;

    return this.upsertJournalEntryTx(tx, {
      entryDate: params.invoice.docDate,
      description: `Postimi i fatures se blerjes ${params.invoice.docNo}`,
      sourceType: 'PURCHASE_INVOICE',
      sourceId: params.invoice.id,
      sourceNo: params.invoice.docNo,
      createdById: params.createdById,
      lines: [
        {
          accountCode: SYSTEM_LEDGER_ACCOUNT_CODES.inventory,
          side: JournalEntryLineSide.DEBIT,
          amount: inventoryTotal,
          partyName,
        },
        {
          accountCode: SYSTEM_LEDGER_ACCOUNT_CODES.vatInput,
          side: JournalEntryLineSide.DEBIT,
          amount: taxTotal,
          partyName,
        },
        {
          accountCode: SYSTEM_LEDGER_ACCOUNT_CODES.accountsPayable,
          side: JournalEntryLineSide.CREDIT,
          amount: grossTotal,
          partyName,
        },
      ],
    });
  }

  async postSalesReturnTx(
    tx: TransactionClient,
    params: {
      salesReturn: {
        id: string;
        docNo: string;
        docDate: Date;
        grandTotal: number | Prisma.Decimal;
        lines: {
          netAmount: number | Prisma.Decimal;
          taxAmount: number | Prisma.Decimal;
        }[];
        customer?: { name?: string | null } | null;
      };
      createdById: string;
      inventoryValue: number;
    },
  ) {
    const netTotal = round2(
      params.salesReturn.lines.reduce((sum, line) => sum + Number(line.netAmount ?? 0), 0),
    );
    const taxTotal = round2(
      params.salesReturn.lines.reduce((sum, line) => sum + Number(line.taxAmount ?? 0), 0),
    );
    const grossTotal = round2(Number(params.salesReturn.grandTotal ?? 0));
    const inventoryValue = round2(params.inventoryValue);
    const partyName = params.salesReturn.customer?.name ?? null;

    return this.upsertJournalEntryTx(tx, {
      entryDate: params.salesReturn.docDate,
      description: `Postimi i kthimit te shitjes ${params.salesReturn.docNo}`,
      sourceType: 'SALES_RETURN',
      sourceId: params.salesReturn.id,
      sourceNo: params.salesReturn.docNo,
      createdById: params.createdById,
      lines: [
        {
          accountCode: SYSTEM_LEDGER_ACCOUNT_CODES.salesReturns,
          side: JournalEntryLineSide.DEBIT,
          amount: netTotal,
          partyName,
        },
        {
          accountCode: SYSTEM_LEDGER_ACCOUNT_CODES.vatOutput,
          side: JournalEntryLineSide.DEBIT,
          amount: taxTotal,
          partyName,
        },
        {
          accountCode: SYSTEM_LEDGER_ACCOUNT_CODES.accountsReceivable,
          side: JournalEntryLineSide.CREDIT,
          amount: grossTotal,
          partyName,
        },
        {
          accountCode: SYSTEM_LEDGER_ACCOUNT_CODES.inventory,
          side: JournalEntryLineSide.DEBIT,
          amount: inventoryValue,
          partyName,
        },
        {
          accountCode: SYSTEM_LEDGER_ACCOUNT_CODES.costOfSales,
          side: JournalEntryLineSide.CREDIT,
          amount: inventoryValue,
          partyName,
        },
      ],
    });
  }

  async postOpeningBalanceTx(
    tx: TransactionClient,
    params: {
      financeTransactionId: string;
      financeAccountId: string;
      amount: number;
      transactionDate: Date;
      referenceNo?: string | null;
      sourceNo?: string | null;
      accountName?: string | null;
      createdById: string;
    },
  ) {
    const account = await tx.financeAccount.findUniqueOrThrow({
      where: { id: params.financeAccountId },
      select: { ledgerAccountId: true, name: true },
    });

    return this.upsertJournalEntryTx(tx, {
      entryDate: params.transactionDate,
      description: `Balanca hapese per ${account.name}`,
      sourceType: 'FINANCE_OPENING',
      sourceId: params.financeTransactionId,
      sourceNo: params.referenceNo ?? params.sourceNo ?? null,
      createdById: params.createdById,
      lines: [
        {
          accountId: account.ledgerAccountId ?? undefined,
          side: JournalEntryLineSide.DEBIT,
          amount: params.amount,
        },
        {
          accountCode: SYSTEM_LEDGER_ACCOUNT_CODES.openingEquity,
          side: JournalEntryLineSide.CREDIT,
          amount: params.amount,
        },
      ],
    });
  }

  async postManualFinanceTransactionTx(
    tx: TransactionClient,
    params: {
      financeTransactionId: string;
      financeAccountId: string;
      transactionType: FinanceAccountTransactionType;
      amount: number;
      transactionDate: Date;
      referenceNo?: string | null;
      counterpartyName?: string | null;
      notes?: string | null;
      createdById: string;
    },
  ) {
    const account = await tx.financeAccount.findUniqueOrThrow({
      where: { id: params.financeAccountId },
      select: { ledgerAccountId: true, name: true },
    });

    const isInbound = params.transactionType === FinanceAccountTransactionType.MANUAL_IN;

    return this.upsertJournalEntryTx(tx, {
      entryDate: params.transactionDate,
      description: `Levizje manuale ${isInbound ? 'hyrese' : 'dalese'} ${account.name}`,
      sourceType: 'FINANCE_MANUAL',
      sourceId: params.financeTransactionId,
      sourceNo: params.referenceNo ?? null,
      createdById: params.createdById,
      lines: isInbound
        ? [
            {
              accountId: account.ledgerAccountId ?? undefined,
              side: JournalEntryLineSide.DEBIT,
              amount: params.amount,
              partyName: params.counterpartyName,
              description: params.notes ?? null,
            },
            {
              accountCode: SYSTEM_LEDGER_ACCOUNT_CODES.otherIncome,
              side: JournalEntryLineSide.CREDIT,
              amount: params.amount,
              partyName: params.counterpartyName,
              description: params.notes ?? null,
            },
          ]
        : [
            {
              accountCode: SYSTEM_LEDGER_ACCOUNT_CODES.otherExpense,
              side: JournalEntryLineSide.DEBIT,
              amount: params.amount,
              partyName: params.counterpartyName,
              description: params.notes ?? null,
            },
            {
              accountId: account.ledgerAccountId ?? undefined,
              side: JournalEntryLineSide.CREDIT,
              amount: params.amount,
              partyName: params.counterpartyName,
              description: params.notes ?? null,
            },
          ],
    });
  }

  async postFinanceTransferTx(
    tx: TransactionClient,
    params: {
      transferGroupId: string;
      sourceTransactionId: string;
      destinationTransactionId: string;
      sourceAccountId: string;
      destinationAccountId: string;
      amount: number;
      transactionDate: Date;
      referenceNo?: string | null;
      createdById: string;
    },
  ) {
    const [source, destination] = await Promise.all([
      tx.financeAccount.findUniqueOrThrow({
        where: { id: params.sourceAccountId },
        select: { ledgerAccountId: true, name: true },
      }),
      tx.financeAccount.findUniqueOrThrow({
        where: { id: params.destinationAccountId },
        select: { ledgerAccountId: true, name: true },
      }),
    ]);

    return this.upsertJournalEntryTx(tx, {
      entryDate: params.transactionDate,
      description: `Transfer financiar ${source.name} -> ${destination.name}`,
      sourceType: 'FINANCE_TRANSFER',
      sourceId: params.transferGroupId,
      sourceNo: params.referenceNo ?? null,
      createdById: params.createdById,
      lines: [
        {
          accountId: destination.ledgerAccountId ?? undefined,
          side: JournalEntryLineSide.DEBIT,
          amount: params.amount,
        },
        {
          accountId: source.ledgerAccountId ?? undefined,
          side: JournalEntryLineSide.CREDIT,
          amount: params.amount,
        },
      ],
    });
  }

  async postReceiptTx(
    tx: TransactionClient,
    params: {
      financeTransactionId: string;
      financeAccountId: string;
      enteredAmount: number;
      appliedAmount: number;
      unappliedAmount: number;
      transactionDate: Date;
      referenceNo?: string | null;
      partyName?: string | null;
      notes?: string | null;
      createdById: string;
    },
  ) {
    const account = await tx.financeAccount.findUniqueOrThrow({
      where: { id: params.financeAccountId },
      select: { ledgerAccountId: true, name: true },
    });

    return this.upsertJournalEntryTx(tx, {
      entryDate: params.transactionDate,
      description: `Arketim ne ${account.name}`,
      sourceType: 'FINANCE_RECEIPT',
      sourceId: params.financeTransactionId,
      sourceNo: params.referenceNo ?? null,
      createdById: params.createdById,
      lines: [
        {
          accountId: account.ledgerAccountId ?? undefined,
          side: JournalEntryLineSide.DEBIT,
          amount: params.enteredAmount,
          partyName: params.partyName,
          description: params.notes ?? null,
        },
        {
          accountCode: SYSTEM_LEDGER_ACCOUNT_CODES.accountsReceivable,
          side: JournalEntryLineSide.CREDIT,
          amount: params.appliedAmount,
          partyName: params.partyName,
          description: params.notes ?? null,
        },
        {
          accountCode: SYSTEM_LEDGER_ACCOUNT_CODES.customerAdvances,
          side: JournalEntryLineSide.CREDIT,
          amount: params.unappliedAmount,
          partyName: params.partyName,
          description: params.notes ?? null,
        },
      ],
    });
  }

  async postPaymentTx(
    tx: TransactionClient,
    params: {
      financeTransactionId: string;
      financeAccountId: string;
      enteredAmount: number;
      appliedAmount: number;
      unappliedAmount: number;
      transactionDate: Date;
      referenceNo?: string | null;
      partyName?: string | null;
      notes?: string | null;
      createdById: string;
    },
  ) {
    const account = await tx.financeAccount.findUniqueOrThrow({
      where: { id: params.financeAccountId },
      select: { ledgerAccountId: true, name: true },
    });

    return this.upsertJournalEntryTx(tx, {
      entryDate: params.transactionDate,
      description: `Pagese nga ${account.name}`,
      sourceType: 'FINANCE_PAYMENT',
      sourceId: params.financeTransactionId,
      sourceNo: params.referenceNo ?? null,
      createdById: params.createdById,
      lines: [
        {
          accountCode: SYSTEM_LEDGER_ACCOUNT_CODES.accountsPayable,
          side: JournalEntryLineSide.DEBIT,
          amount: params.appliedAmount,
          partyName: params.partyName,
          description: params.notes ?? null,
        },
        {
          accountCode: SYSTEM_LEDGER_ACCOUNT_CODES.supplierAdvances,
          side: JournalEntryLineSide.DEBIT,
          amount: params.unappliedAmount,
          partyName: params.partyName,
          description: params.notes ?? null,
        },
        {
          accountId: account.ledgerAccountId ?? undefined,
          side: JournalEntryLineSide.CREDIT,
          amount: params.enteredAmount,
          partyName: params.partyName,
          description: params.notes ?? null,
        },
      ],
    });
  }

  async postSettlementAllocationTx(
    tx: TransactionClient,
    params: {
      financeSettlementType: FinanceSettlementType;
      allocationId: string;
      allocationDate: Date;
      amount: number;
      referenceNo?: string | null;
      partyName?: string | null;
      notes?: string | null;
      createdById: string;
    },
  ) {
    const lines =
      params.financeSettlementType === FinanceSettlementType.RECEIPT
        ? [
            {
              accountCode: SYSTEM_LEDGER_ACCOUNT_CODES.customerAdvances,
              side: JournalEntryLineSide.DEBIT,
              amount: params.amount,
              partyName: params.partyName,
              description: params.notes ?? null,
            },
            {
              accountCode: SYSTEM_LEDGER_ACCOUNT_CODES.accountsReceivable,
              side: JournalEntryLineSide.CREDIT,
              amount: params.amount,
              partyName: params.partyName,
              description: params.notes ?? null,
            },
          ]
        : [
            {
              accountCode: SYSTEM_LEDGER_ACCOUNT_CODES.accountsPayable,
              side: JournalEntryLineSide.DEBIT,
              amount: params.amount,
              partyName: params.partyName,
              description: params.notes ?? null,
            },
            {
              accountCode: SYSTEM_LEDGER_ACCOUNT_CODES.supplierAdvances,
              side: JournalEntryLineSide.CREDIT,
              amount: params.amount,
              partyName: params.partyName,
              description: params.notes ?? null,
            },
          ];

    return this.upsertJournalEntryTx(tx, {
      entryDate: params.allocationDate,
      description:
        params.financeSettlementType === FinanceSettlementType.RECEIPT
          ? 'Rialokim i arketimit unapplied'
          : 'Rialokim i pageses unapplied',
      sourceType:
        params.financeSettlementType === FinanceSettlementType.RECEIPT
          ? 'RECEIPT_ALLOCATION'
          : 'PAYMENT_ALLOCATION',
      sourceId: params.allocationId,
      sourceNo: params.referenceNo ?? null,
      createdById: params.createdById,
      lines,
    });
  }

  async postInventoryAdjustmentTx(
    tx: TransactionClient,
    params: {
      sourceType: 'STOCK_ADJUSTMENT' | 'STOCK_COUNT';
      sourceId: string;
      referenceNo?: string | null;
      movementDate: Date;
      amount: number;
      isPositive: boolean;
      itemName?: string | null;
      createdById: string;
    },
  ) {
    return this.upsertJournalEntryTx(tx, {
      entryDate: params.movementDate,
      description:
        params.sourceType === 'STOCK_ADJUSTMENT'
          ? `Adjustim stoku ${params.referenceNo ?? ''}`.trim()
          : `Numerim stoku ${params.referenceNo ?? ''}`.trim(),
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      sourceNo: params.referenceNo ?? null,
      createdById: params.createdById,
      lines: params.isPositive
        ? [
            {
              accountCode: SYSTEM_LEDGER_ACCOUNT_CODES.inventory,
              side: JournalEntryLineSide.DEBIT,
              amount: params.amount,
              partyName: params.itemName,
            },
            {
              accountCode: SYSTEM_LEDGER_ACCOUNT_CODES.inventoryGain,
              side: JournalEntryLineSide.CREDIT,
              amount: params.amount,
              partyName: params.itemName,
            },
          ]
        : [
            {
              accountCode: SYSTEM_LEDGER_ACCOUNT_CODES.inventoryLoss,
              side: JournalEntryLineSide.DEBIT,
              amount: params.amount,
              partyName: params.itemName,
            },
            {
              accountCode: SYSTEM_LEDGER_ACCOUNT_CODES.inventory,
              side: JournalEntryLineSide.CREDIT,
              amount: params.amount,
              partyName: params.itemName,
            },
          ],
    });
  }
}
