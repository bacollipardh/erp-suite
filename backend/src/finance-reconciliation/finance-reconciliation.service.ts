import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  FinanceAccountTransactionType,
  FinanceAccountType,
  FinanceStatementLineDirection,
  FinanceStatementLineStatus,
  Prisma,
} from '@prisma/client';
import {
  calculateStatementRemainingAmount,
  calculateTransactionAvailableAmount,
  resolveStatementLineStatus,
} from '../common/utils/finance-reconciliation';
import { round2 } from '../common/utils/money';
import { toPaginatedResponse, toPagination } from '../common/utils/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { ApplyFinanceStatementMatchDto } from './dto/apply-finance-statement-match.dto';
import { CreateFinanceStatementLineDto } from './dto/create-finance-statement-line.dto';
import { ListFinanceStatementLinesQueryDto } from './dto/list-finance-statement-lines-query.dto';

function normalizeOptional(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function toSafeDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('Invalid date');
  }
  return date;
}

function isInboundTransaction(type: FinanceAccountTransactionType) {
  return (
    type === FinanceAccountTransactionType.OPENING ||
    type === FinanceAccountTransactionType.MANUAL_IN ||
    type === FinanceAccountTransactionType.TRANSFER_IN ||
    type === FinanceAccountTransactionType.RECEIPT
  );
}

function isOutboundTransaction(type: FinanceAccountTransactionType) {
  return (
    type === FinanceAccountTransactionType.MANUAL_OUT ||
    type === FinanceAccountTransactionType.TRANSFER_OUT ||
    type === FinanceAccountTransactionType.PAYMENT
  );
}

function directionMatchesTransaction(
  direction: FinanceStatementLineDirection,
  transactionType: FinanceAccountTransactionType,
) {
  return direction === FinanceStatementLineDirection.IN
    ? isInboundTransaction(transactionType)
    : isOutboundTransaction(transactionType);
}

function dateDistanceDays(left: Date, right: Date) {
  return Math.abs(left.getTime() - right.getTime()) / 86_400_000;
}

type StatementLineForMatching = {
  accountId: string;
  direction: FinanceStatementLineDirection;
  amount: Prisma.Decimal | number | string;
  statementDate: Date;
  referenceNo?: string | null;
  counterpartyName?: string | null;
};

@Injectable()
export class FinanceReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  async listStatementLines(query: ListFinanceStatementLinesQueryDto = {}) {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.max(query.limit ?? 20, 1);
    const { skip, take } = toPagination(page, limit);
    const search = query.search?.trim();

    const where: Prisma.FinanceStatementLineWhereInput = {
      accountId: query.financeAccountId,
      direction: query.direction,
      status: query.status,
      statementDate:
        query.dateFrom || query.dateTo
          ? {
              gte: query.dateFrom ? new Date(query.dateFrom) : undefined,
              lte: query.dateTo ? new Date(query.dateTo) : undefined,
            }
          : undefined,
      OR: search
        ? [
            { referenceNo: { contains: search, mode: 'insensitive' } },
            { externalId: { contains: search, mode: 'insensitive' } },
            { counterpartyName: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { notes: { contains: search, mode: 'insensitive' } },
            { account: { code: { contains: search, mode: 'insensitive' } } },
            { account: { name: { contains: search, mode: 'insensitive' } } },
          ]
        : undefined,
    };

    const sortBy = query.sortBy ?? 'statementDate';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
    const orderBy: Prisma.FinanceStatementLineOrderByWithRelationInput =
      sortBy === 'amount'
        ? { amount: sortOrder }
        : sortBy === 'status'
          ? { status: sortOrder }
          : sortBy === 'account'
            ? { account: { name: sortOrder } }
            : { statementDate: sortOrder };

    const [items, total, totals] = await this.prisma.$transaction([
      this.prisma.financeStatementLine.findMany({
        where,
        include: {
          account: true,
          matches: {
            include: {
              financeAccountTransaction: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy,
        skip,
        take,
      }),
      this.prisma.financeStatementLine.count({ where }),
      this.prisma.financeStatementLine.findMany({
        where,
        select: {
          id: true,
          accountId: true,
          direction: true,
          status: true,
          amount: true,
          matchedAmount: true,
        },
      }),
    ]);

    const totalIn = round2(
      totals
        .filter((row) => row.direction === FinanceStatementLineDirection.IN)
        .reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
    );
    const totalOut = round2(
      totals
        .filter((row) => row.direction === FinanceStatementLineDirection.OUT)
        .reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
    );
    const totalMatched = round2(totals.reduce((sum, row) => sum + Number(row.matchedAmount ?? 0), 0));

    return {
      ...toPaginatedResponse({
        items: items.map((row) => this.mapStatementLine(row)),
        total,
        page,
        limit,
      }),
      summary: {
        lineCount: totals.length,
        accountCount: new Set(totals.map((row) => row.accountId)).size,
        unmatchedCount: totals.filter((row) => row.status === FinanceStatementLineStatus.UNMATCHED).length,
        partiallyMatchedCount: totals.filter((row) => row.status === FinanceStatementLineStatus.PARTIALLY_MATCHED).length,
        matchedCount: totals.filter((row) => row.status === FinanceStatementLineStatus.MATCHED).length,
        totalIn,
        totalOut,
        totalMatched,
        totalUnmatched: round2(totalIn + totalOut - totalMatched),
      },
    };
  }

  async createStatementLine(dto: CreateFinanceStatementLineDto, userId: string) {
    const account = await this.prisma.financeAccount.findUnique({
      where: { id: dto.financeAccountId },
    });

    if (!account) {
      throw new NotFoundException('Finance account not found');
    }

    if (!account.isActive) {
      throw new BadRequestException('Finance account is inactive');
    }

    if (account.accountType !== FinanceAccountType.BANK) {
      throw new BadRequestException('Bank reconciliation can only be used with bank accounts');
    }

    const amount = round2(Number(dto.amount));
    const statementDate = toSafeDate(dto.statementDate);
    const valueDate = dto.valueDate ? toSafeDate(dto.valueDate) : null;

    const line = await this.prisma.financeStatementLine.create({
      data: {
        accountId: account.id,
        direction: dto.direction,
        statementDate,
        valueDate,
        amount,
        matchedAmount: 0,
        status: FinanceStatementLineStatus.UNMATCHED,
        statementBalance:
          dto.statementBalance === undefined ? undefined : round2(Number(dto.statementBalance)),
        referenceNo: normalizeOptional(dto.referenceNo),
        externalId: normalizeOptional(dto.externalId),
        counterpartyName: normalizeOptional(dto.counterpartyName),
        description: normalizeOptional(dto.description),
        notes: normalizeOptional(dto.notes),
        createdById: userId,
      },
      include: {
        account: true,
        matches: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        entityType: 'finance_statement_lines',
        entityId: line.id,
        action: 'CREATE',
        metadata: {
          accountId: account.id,
          accountCode: account.code,
          direction: dto.direction,
          amount,
          statementDate: statementDate.toISOString(),
          referenceNo: dto.referenceNo,
        } as Prisma.InputJsonValue,
      },
    });

    return this.mapStatementLine(line);
  }

  async getStatementLineWorkspace(id: string) {
    const line = await this.getStatementLineOrThrow(id);
    const candidates = await this.getCandidatesForLine(line);

    return {
      statementLine: this.mapStatementLine(line),
      candidates,
    };
  }

  async createMatch(id: string, dto: ApplyFinanceStatementMatchDto, userId: string) {
    const requestedAmount = round2(Number(dto.amount ?? 0));
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      throw new BadRequestException('Match amount must be greater than zero');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const line = await tx.financeStatementLine.findUnique({
        where: { id },
        include: { matches: true, account: true },
      });

      if (!line) {
        throw new NotFoundException('Statement line not found');
      }

      const existingPair = await tx.financeStatementMatch.findUnique({
        where: {
          statementLineId_financeAccountTransactionId: {
            statementLineId: line.id,
            financeAccountTransactionId: dto.financeAccountTransactionId,
          },
        },
      });

      if (existingPair) {
        throw new ConflictException('This statement line is already matched to that ledger transaction');
      }

      const transaction = await tx.financeAccountTransaction.findUnique({
        where: { id: dto.financeAccountTransactionId },
        include: { statementMatches: true },
      });

      if (!transaction) {
        throw new NotFoundException('Ledger transaction not found');
      }

      if (transaction.accountId !== line.accountId) {
        throw new BadRequestException('Statement line and ledger transaction must belong to the same account');
      }

      if (!directionMatchesTransaction(line.direction, transaction.transactionType)) {
        throw new BadRequestException('Statement direction does not match ledger transaction direction');
      }

      const lineRemaining = calculateStatementRemainingAmount(
        Number(line.amount ?? 0),
        Number(line.matchedAmount ?? 0),
      );
      const transactionMatchedAmount = round2(
        transaction.statementMatches.reduce((sum, match) => sum + Number(match.amount ?? 0), 0),
      );
      const transactionAvailable = calculateTransactionAvailableAmount(
        Number(transaction.amount ?? 0),
        transactionMatchedAmount,
      );

      if (requestedAmount > lineRemaining) {
        throw new BadRequestException('Match amount exceeds remaining statement amount');
      }

      if (requestedAmount > transactionAvailable) {
        throw new BadRequestException('Match amount exceeds available ledger transaction amount');
      }

      const match = await tx.financeStatementMatch.create({
        data: {
          statementLineId: line.id,
          financeAccountTransactionId: transaction.id,
          amount: requestedAmount,
          notes: normalizeOptional(dto.notes),
          createdById: userId,
        },
      });

      const nextMatchedAmount = round2(Number(line.matchedAmount ?? 0) + requestedAmount);
      const nextStatus = resolveStatementLineStatus(Number(line.amount ?? 0), nextMatchedAmount);

      const updatedLine = await tx.financeStatementLine.update({
        where: { id: line.id },
        data: {
          matchedAmount: nextMatchedAmount,
          status: nextStatus,
        },
        include: {
          account: true,
          matches: {
            include: { financeAccountTransaction: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          entityType: 'finance_statement_lines',
          entityId: line.id,
          action: 'MATCH_LEDGER_TRANSACTION',
          metadata: {
            matchId: match.id,
            financeAccountTransactionId: transaction.id,
            amount: requestedAmount,
            matchedAmountBefore: Number(line.matchedAmount ?? 0),
            matchedAmountAfter: nextMatchedAmount,
            statusBefore: line.status,
            statusAfter: nextStatus,
          } as Prisma.InputJsonValue,
        },
      });

      return updatedLine;
    });

    return this.getStatementLineWorkspace(result.id);
  }

  async removeMatch(id: string, matchId: string, userId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const match = await tx.financeStatementMatch.findUnique({
        where: { id: matchId },
        include: {
          statementLine: true,
          financeAccountTransaction: true,
        },
      });

      if (!match || match.statementLineId !== id) {
        throw new NotFoundException('Statement match not found');
      }

      await tx.financeStatementMatch.delete({ where: { id: match.id } });

      const nextMatchedAmount = round2(
        Math.max(0, Number(match.statementLine.matchedAmount ?? 0) - Number(match.amount ?? 0)),
      );
      const nextStatus = resolveStatementLineStatus(
        Number(match.statementLine.amount ?? 0),
        nextMatchedAmount,
      );

      const updatedLine = await tx.financeStatementLine.update({
        where: { id: match.statementLineId },
        data: {
          matchedAmount: nextMatchedAmount,
          status: nextStatus,
        },
        include: {
          account: true,
          matches: {
            include: { financeAccountTransaction: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          entityType: 'finance_statement_lines',
          entityId: match.statementLineId,
          action: 'REMOVE_LEDGER_MATCH',
          metadata: {
            matchId: match.id,
            financeAccountTransactionId: match.financeAccountTransactionId,
            amount: Number(match.amount ?? 0),
            matchedAmountBefore: Number(match.statementLine.matchedAmount ?? 0),
            matchedAmountAfter: nextMatchedAmount,
            statusBefore: match.statementLine.status,
            statusAfter: nextStatus,
          } as Prisma.InputJsonValue,
        },
      });

      return updatedLine;
    });

    return this.getStatementLineWorkspace(result.id);
  }

  private async getStatementLineOrThrow(id: string) {
    const line = await this.prisma.financeStatementLine.findUnique({
      where: { id },
      include: {
        account: true,
        createdBy: {
          select: { id: true, fullName: true, email: true },
        },
        matches: {
          include: {
            financeAccountTransaction: {
              include: {
                account: true,
                createdBy: {
                  select: { id: true, fullName: true, email: true },
                },
              },
            },
            createdBy: {
              select: { id: true, fullName: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!line) {
      throw new NotFoundException('Statement line not found');
    }

    return line;
  }

  private async getCandidatesForLine(line: StatementLineForMatching) {
    const transactions = await this.prisma.financeAccountTransaction.findMany({
      where: {
        accountId: line.accountId,
      },
      include: {
        account: true,
        createdBy: {
          select: { id: true, fullName: true, email: true },
        },
        statementMatches: true,
      },
      orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });

    return transactions
      .filter((transaction) => directionMatchesTransaction(line.direction, transaction.transactionType))
      .map((transaction) => {
        const matchedAmount = round2(
          transaction.statementMatches.reduce((sum, match) => sum + Number(match.amount ?? 0), 0),
        );
        const availableAmount = calculateTransactionAvailableAmount(
          Number(transaction.amount ?? 0),
          matchedAmount,
        );
        const amountDiff = Math.abs(Number(line.amount ?? 0) - availableAmount);
        const dateDiff = dateDistanceDays(line.statementDate, transaction.transactionDate);
        const referenceMatch =
          normalizeOptional(line.referenceNo) &&
          normalizeOptional(transaction.referenceNo) &&
          normalizeOptional(line.referenceNo)?.toLowerCase() ===
            normalizeOptional(transaction.referenceNo)?.toLowerCase();
        const partyMatch =
          normalizeOptional(line.counterpartyName) &&
          normalizeOptional(transaction.counterpartyName) &&
          normalizeOptional(transaction.counterpartyName)
            ?.toLowerCase()
            .includes(normalizeOptional(line.counterpartyName)?.toLowerCase() ?? '');

        return {
          id: transaction.id,
          transactionType: transaction.transactionType,
          transactionDate: transaction.transactionDate,
          amount: Number(transaction.amount ?? 0),
          matchedAmount,
          availableAmount,
          referenceNo: transaction.referenceNo ?? null,
          counterpartyName: transaction.counterpartyName ?? null,
          sourceDocumentType: transaction.sourceDocumentType ?? null,
          sourceDocumentId: transaction.sourceDocumentId ?? null,
          sourceDocumentNo: transaction.sourceDocumentNo ?? null,
          notes: transaction.notes ?? null,
          balanceAfter: Number(transaction.balanceAfter ?? 0),
          createdAt: transaction.createdAt,
          createdBy: transaction.createdBy,
          score: round2(amountDiff + dateDiff * 0.05 + (referenceMatch ? -5 : 0) + (partyMatch ? -2 : 0)),
        };
      })
      .filter((transaction) => transaction.availableAmount > 0)
      .sort((left, right) => {
        if (left.score !== right.score) return left.score - right.score;
        if (left.availableAmount !== right.availableAmount) {
          return Math.abs(Number(line.amount ?? 0) - left.availableAmount) -
            Math.abs(Number(line.amount ?? 0) - right.availableAmount);
        }
        return new Date(right.transactionDate).getTime() - new Date(left.transactionDate).getTime();
      })
      .slice(0, 50);
  }

  private mapStatementLine(row: any) {
    const amount = Number(row.amount ?? 0);
    const matchedAmount = Number(row.matchedAmount ?? 0);

    return {
      id: row.id,
      direction: row.direction,
      status: row.status,
      statementDate: row.statementDate,
      valueDate: row.valueDate ?? null,
      amount,
      matchedAmount,
      remainingAmount: calculateStatementRemainingAmount(amount, matchedAmount),
      statementBalance: row.statementBalance === null ? null : Number(row.statementBalance ?? 0),
      referenceNo: row.referenceNo ?? null,
      externalId: row.externalId ?? null,
      counterpartyName: row.counterpartyName ?? null,
      description: row.description ?? null,
      notes: row.notes ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      account: row.account
        ? {
            id: row.account.id,
            code: row.account.code,
            name: row.account.name,
            accountType: row.account.accountType,
            currentBalance: Number(row.account.currentBalance ?? 0),
            currencyCode: row.account.currencyCode,
          }
        : null,
      createdBy: row.createdBy
        ? {
            id: row.createdBy.id,
            fullName: row.createdBy.fullName,
            email: row.createdBy.email ?? null,
          }
        : null,
      matches: (row.matches ?? []).map((match: any) => ({
        id: match.id,
        amount: Number(match.amount ?? 0),
        notes: match.notes ?? null,
        createdAt: match.createdAt,
        createdBy: match.createdBy
          ? {
              id: match.createdBy.id,
              fullName: match.createdBy.fullName,
              email: match.createdBy.email ?? null,
            }
          : null,
        transaction: match.financeAccountTransaction
          ? {
              id: match.financeAccountTransaction.id,
              transactionType: match.financeAccountTransaction.transactionType,
              amount: Number(match.financeAccountTransaction.amount ?? 0),
              transactionDate: match.financeAccountTransaction.transactionDate,
              referenceNo: match.financeAccountTransaction.referenceNo ?? null,
              counterpartyName: match.financeAccountTransaction.counterpartyName ?? null,
              sourceDocumentType: match.financeAccountTransaction.sourceDocumentType ?? null,
              sourceDocumentId: match.financeAccountTransaction.sourceDocumentId ?? null,
              sourceDocumentNo: match.financeAccountTransaction.sourceDocumentNo ?? null,
              notes: match.financeAccountTransaction.notes ?? null,
            }
          : null,
      })),
      matchCount: row.matches?.length ?? 0,
    };
  }
}
