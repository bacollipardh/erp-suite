import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import {
  FinanceAccountTransactionType,
  FinanceAccountType,
  FinanceSettlementType,
  JournalEntryLineSide,
  LedgerAccountCategory,
  LedgerAccountReportSection,
  Prisma,
} from '@prisma/client';
import { round2 } from '../common/utils/money';
import { toPaginatedResponse, toPagination } from '../common/utils/pagination';
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
import { ListJournalEntriesQueryDto } from './dto/list-journal-entries-query.dto';
import { ListLedgerAccountsQueryDto } from './dto/list-ledger-accounts-query.dto';

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
  constructor(private readonly prisma: PrismaService) {}

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
    },
  ) {
    const lines = await client.journalEntryLine.findMany({
      where: {
        accountId: params?.accountIds?.length ? { in: params.accountIds } : undefined,
        journalEntry: params?.beforeDate
          ? { entryDate: { lt: params.beforeDate } }
          : params?.dateFrom || params?.dateTo
            ? {
                entryDate: {
                  gte: params.dateFrom ?? undefined,
                  lte: params.dateTo ?? undefined,
                },
              }
            : undefined,
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
          allowManual: false,
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
          allowManual: false,
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

    const pnl = await this.getProfitAndLoss({
      dateFrom: '2000-01-01',
      dateTo: asOfDate.toISOString().slice(0, 10),
      includeZero: false,
    });
    const currentEarnings = round2(Number(pnl.summary.netProfit ?? 0));

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
