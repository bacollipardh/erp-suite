import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CashDailyCloseStatus,
  FinanceAccountTransactionType,
  FinanceAccountType,
  Prisma,
} from '@prisma/client';
import { round2 } from '../common/utils/money';
import { toPaginatedResponse, toPagination } from '../common/utils/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { CloseCashDailyCloseDto } from './dto/close-cash-daily-close.dto';
import { ListCashDailyCloseQueryDto } from './dto/list-cash-daily-close-query.dto';
import { OpenCashDailyCloseDto } from './dto/open-cash-daily-close.dto';

function toDateOnly(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('Invalid business date');
  }
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isInbound(type: FinanceAccountTransactionType) {
  return new Set<FinanceAccountTransactionType>([
    FinanceAccountTransactionType.OPENING,
    FinanceAccountTransactionType.MANUAL_IN,
    FinanceAccountTransactionType.TRANSFER_IN,
    FinanceAccountTransactionType.RECEIPT,
  ]).has(type);
}

function isOutbound(type: FinanceAccountTransactionType) {
  return new Set<FinanceAccountTransactionType>([
    FinanceAccountTransactionType.MANUAL_OUT,
    FinanceAccountTransactionType.TRANSFER_OUT,
    FinanceAccountTransactionType.PAYMENT,
  ]).has(type);
}

function normalizeNotes(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || null;
}

@Injectable()
export class CashDailyCloseService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListCashDailyCloseQueryDto = {}) {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.max(query.limit ?? 20, 1);
    const { skip, take } = toPagination(page, limit);
    const where: Prisma.CashDailyCloseWhereInput = {
      financeAccountId: query.financeAccountId,
      businessDate: query.businessDate ? toDateOnly(query.businessDate) : undefined,
      status: query.status,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.cashDailyClose.findMany({
        where,
        include: this.includeRelations(),
        orderBy: [{ businessDate: 'desc' }, { openedAt: 'desc' }],
        skip,
        take,
      }),
      this.prisma.cashDailyClose.count({ where }),
    ]);

    return toPaginatedResponse({ items, total, page, limit });
  }

  async summary(dateInput?: string) {
    const businessDate = toDateOnly(dateInput ?? new Date());
    const [accounts, closes] = await this.prisma.$transaction([
      this.prisma.financeAccount.findMany({
        where: { accountType: FinanceAccountType.CASH, isActive: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.cashDailyClose.findMany({
        where: { businessDate },
        include: this.includeRelations(),
        orderBy: { openedAt: 'desc' },
      }),
    ]);

    const closeByAccount = new Map(closes.map((entry) => [entry.financeAccountId, entry]));
    const rows = await Promise.all(
      accounts.map(async (account) => {
        const close = closeByAccount.get(account.id) ?? null;
        const totals = close
          ? {
              totalIn: Number(close.totalIn),
              totalOut: Number(close.totalOut),
              expectedClosingBalance: Number(close.expectedClosingBalance),
            }
          : await this.calculateTotals(account.id, businessDate, Number(account.currentBalance ?? 0));

        return {
          account,
          close,
          totalIn: totals.totalIn,
          totalOut: totals.totalOut,
          expectedClosingBalance: totals.expectedClosingBalance,
          status: close?.status ?? 'NOT_OPENED',
        };
      }),
    );

    return {
      businessDate,
      summary: {
        cashAccountCount: accounts.length,
        openedCount: closes.filter((entry) => entry.status === CashDailyCloseStatus.OPEN).length,
        closedCount: closes.filter((entry) => entry.status === CashDailyCloseStatus.CLOSED).length,
        notOpenedCount: Math.max(0, accounts.length - closes.length),
        totalExpectedClosing: round2(
          rows.reduce((sum, row) => sum + Number(row.expectedClosingBalance ?? 0), 0),
        ),
        totalCounted: round2(
          closes.reduce((sum, row) => sum + Number(row.countedCashAmount ?? 0), 0),
        ),
        totalDifference: round2(
          closes.reduce((sum, row) => sum + Number(row.differenceAmount ?? 0), 0),
        ),
      },
      rows,
    };
  }

  async open(dto: OpenCashDailyCloseDto, userId: string) {
    const businessDate = toDateOnly(dto.businessDate);
    const account = await this.prisma.financeAccount.findUnique({
      where: { id: dto.financeAccountId },
    });
    if (!account) throw new NotFoundException('Finance account not found');
    if (!account.isActive) throw new BadRequestException('Finance account is inactive');
    if (account.accountType !== FinanceAccountType.CASH) {
      throw new BadRequestException('Daily close is available only for CASH accounts');
    }

    const existing = await this.prisma.cashDailyClose.findUnique({
      where: {
        financeAccountId_businessDate: {
          financeAccountId: account.id,
          businessDate,
        },
      },
    });
    if (existing && existing.status !== CashDailyCloseStatus.CANCELLED) {
      throw new ConflictException('Daily close already exists for this account and date');
    }

    const previousClose = await this.prisma.cashDailyClose.findFirst({
      where: {
        financeAccountId: account.id,
        businessDate: { lt: businessDate },
        status: CashDailyCloseStatus.CLOSED,
      },
      orderBy: { businessDate: 'desc' },
    });
    const openingBalance = round2(
      Number(dto.openingBalance ?? previousClose?.countedCashAmount ?? account.currentBalance ?? 0),
    );
    const totals = await this.calculateTotals(account.id, businessDate, openingBalance);

    const created = await this.prisma.cashDailyClose.upsert({
      where: {
        financeAccountId_businessDate: {
          financeAccountId: account.id,
          businessDate,
        },
      },
      update: {
        status: CashDailyCloseStatus.OPEN,
        openingBalance,
        totalIn: totals.totalIn,
        totalOut: totals.totalOut,
        expectedClosingBalance: totals.expectedClosingBalance,
        countedCashAmount: null,
        differenceAmount: null,
        openingNotes: normalizeNotes(dto.openingNotes),
        closingNotes: null,
        openedById: userId,
        closedById: null,
        openedAt: new Date(),
        closedAt: null,
      },
      create: {
        financeAccountId: account.id,
        businessDate,
        status: CashDailyCloseStatus.OPEN,
        openingBalance,
        totalIn: totals.totalIn,
        totalOut: totals.totalOut,
        expectedClosingBalance: totals.expectedClosingBalance,
        openingNotes: normalizeNotes(dto.openingNotes),
        openedById: userId,
      },
      include: this.includeRelations(),
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        entityType: 'cash_daily_closes',
        entityId: created.id,
        action: 'OPEN',
        metadata: {
          financeAccountId: account.id,
          accountCode: account.code,
          businessDate: businessDate.toISOString(),
          openingBalance,
        } as Prisma.InputJsonValue,
      },
    });

    return created;
  }

  async close(id: string, dto: CloseCashDailyCloseDto, userId: string) {
    const existing = await this.prisma.cashDailyClose.findUnique({
      where: { id },
      include: { financeAccount: true },
    });
    if (!existing) throw new NotFoundException('Daily close not found');
    if (existing.status === CashDailyCloseStatus.CLOSED) {
      throw new ConflictException('Daily close is already closed');
    }
    if (existing.status === CashDailyCloseStatus.CANCELLED) {
      throw new BadRequestException('Cancelled daily close cannot be closed');
    }

    const totals = await this.calculateTotals(
      existing.financeAccountId,
      existing.businessDate,
      Number(existing.openingBalance ?? 0),
    );
    const countedCashAmount = round2(Number(dto.countedCashAmount));
    const differenceAmount = round2(countedCashAmount - totals.expectedClosingBalance);

    const closed = await this.prisma.cashDailyClose.update({
      where: { id },
      data: {
        status: CashDailyCloseStatus.CLOSED,
        totalIn: totals.totalIn,
        totalOut: totals.totalOut,
        expectedClosingBalance: totals.expectedClosingBalance,
        countedCashAmount,
        differenceAmount,
        closingNotes: normalizeNotes(dto.closingNotes),
        closedById: userId,
        closedAt: new Date(),
      },
      include: this.includeRelations(),
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        entityType: 'cash_daily_closes',
        entityId: closed.id,
        action: 'CLOSE',
        metadata: {
          financeAccountId: closed.financeAccountId,
          businessDate: closed.businessDate.toISOString(),
          countedCashAmount,
          expectedClosingBalance: totals.expectedClosingBalance,
          differenceAmount,
        } as Prisma.InputJsonValue,
      },
    });

    return closed;
  }

  private async calculateTotals(
    financeAccountId: string,
    businessDate: Date,
    openingBalance: number,
  ) {
    const transactions = await this.prisma.financeAccountTransaction.findMany({
      where: { accountId: financeAccountId, transactionDate: businessDate },
      select: { amount: true, transactionType: true },
    });
    const totalIn = round2(
      transactions
        .filter((entry) => isInbound(entry.transactionType))
        .reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0),
    );
    const totalOut = round2(
      transactions
        .filter((entry) => isOutbound(entry.transactionType))
        .reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0),
    );
    return {
      totalIn,
      totalOut,
      expectedClosingBalance: round2(Number(openingBalance ?? 0) + totalIn - totalOut),
    };
  }

  private includeRelations() {
    return {
      financeAccount: true,
      openedBy: { select: { id: true, fullName: true, email: true } },
      closedBy: { select: { id: true, fullName: true, email: true } },
    } satisfies Prisma.CashDailyCloseInclude;
  }
}
