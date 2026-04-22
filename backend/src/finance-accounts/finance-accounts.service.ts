import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FinanceAccountTransactionType,
  FinanceAccountType,
  Prisma,
} from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { round2 } from '../common/utils/money';
import { toPaginatedResponse, toPagination } from '../common/utils/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFinanceAccountDto } from './dto/create-finance-account.dto';
import { CreateFinanceAccountTransactionDto } from './dto/create-finance-account-transaction.dto';
import { CreateFinanceTransferDto } from './dto/create-finance-transfer.dto';
import { ListFinanceAccountsQueryDto } from './dto/list-finance-accounts-query.dto';
import { ListFinanceAccountTransactionsQueryDto } from './dto/list-finance-account-transactions-query.dto';

type TransactionClient = Prisma.TransactionClient;

function normalizeOptional(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

function normalizeDateOnly(value?: string | Date | null) {
  if (!value) return new Date();
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('Invalid transaction date');
  }
  return date;
}

function isInboundType(type: FinanceAccountTransactionType) {
  return (
    type === FinanceAccountTransactionType.OPENING ||
    type === FinanceAccountTransactionType.MANUAL_IN ||
    type === FinanceAccountTransactionType.TRANSFER_IN ||
    type === FinanceAccountTransactionType.RECEIPT
  );
}

function isOutboundType(type: FinanceAccountTransactionType) {
  return (
    type === FinanceAccountTransactionType.MANUAL_OUT ||
    type === FinanceAccountTransactionType.TRANSFER_OUT ||
    type === FinanceAccountTransactionType.PAYMENT
  );
}

@Injectable()
export class FinanceAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async findAll(query: ListFinanceAccountsQueryDto = {}) {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.max(query.limit ?? 20, 1);
    const { skip, take } = toPagination(page, limit);
    const search = query.search?.trim();

    const where: Prisma.FinanceAccountWhereInput = {
      accountType: query.accountType,
      isActive:
        typeof query.isActive === 'string'
          ? query.isActive === 'true'
          : undefined,
      OR: search
        ? [
            { code: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
            { bankName: { contains: search, mode: 'insensitive' } },
            { bankAccountNo: { contains: search, mode: 'insensitive' } },
            { iban: { contains: search, mode: 'insensitive' } },
          ]
        : undefined,
    };

    const sortBy = query.sortBy ?? 'name';
    const sortOrder = query.sortOrder === 'desc' ? 'desc' : 'asc';

    const orderBy: Prisma.FinanceAccountOrderByWithRelationInput =
      sortBy === 'currentBalance'
        ? { currentBalance: sortOrder }
        : sortBy === 'createdAt'
          ? { createdAt: sortOrder }
          : sortBy === 'code'
            ? { code: sortOrder }
            : { name: sortOrder };

    const [items, total, totals] = await this.prisma.$transaction([
      this.prisma.financeAccount.findMany({
        where,
        orderBy,
        skip,
        take,
      }),
      this.prisma.financeAccount.count({ where }),
      this.prisma.financeAccount.findMany({
        where,
        select: {
          id: true,
          accountType: true,
          currentBalance: true,
          isActive: true,
        },
      }),
    ]);

    const summary = {
      accountCount: totals.length,
      activeCount: totals.filter((row) => row.isActive).length,
      inactiveCount: totals.filter((row) => !row.isActive).length,
      cashBalance: round2(
        totals
          .filter((row) => row.accountType === FinanceAccountType.CASH)
          .reduce((sum, row) => sum + Number(row.currentBalance ?? 0), 0),
      ),
      bankBalance: round2(
        totals
          .filter((row) => row.accountType === FinanceAccountType.BANK)
          .reduce((sum, row) => sum + Number(row.currentBalance ?? 0), 0),
      ),
      totalBalance: round2(
        totals.reduce((sum, row) => sum + Number(row.currentBalance ?? 0), 0),
      ),
      negativeBalanceCount: totals.filter((row) => Number(row.currentBalance ?? 0) < 0).length,
    };

    return {
      ...toPaginatedResponse({ items, total, page, limit }),
      summary,
    };
  }

  async findTransactions(query: ListFinanceAccountTransactionsQueryDto = {}) {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.max(query.limit ?? 20, 1);
    const { skip, take } = toPagination(page, limit);
    const search = query.search?.trim();

    const where: Prisma.FinanceAccountTransactionWhereInput = {
      accountId: query.accountId,
      transactionType: query.transactionType,
      transactionDate:
        query.dateFrom || query.dateTo
          ? {
              gte: query.dateFrom ? new Date(query.dateFrom) : undefined,
              lte: query.dateTo ? new Date(query.dateTo) : undefined,
            }
          : undefined,
      account: {
        accountType: query.accountType,
      },
      OR: search
        ? [
            { referenceNo: { contains: search, mode: 'insensitive' } },
            { notes: { contains: search, mode: 'insensitive' } },
            { counterpartyName: { contains: search, mode: 'insensitive' } },
            { sourceDocumentNo: { contains: search, mode: 'insensitive' } },
            { account: { code: { contains: search, mode: 'insensitive' } } },
            { account: { name: { contains: search, mode: 'insensitive' } } },
          ]
        : undefined,
    };

    const sortBy = query.sortBy ?? 'transactionDate';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

    const orderBy: Prisma.FinanceAccountTransactionOrderByWithRelationInput =
      sortBy === 'amount'
        ? { amount: sortOrder }
        : sortBy === 'account'
          ? { account: { name: sortOrder } }
          : sortBy === 'createdAt'
            ? { createdAt: sortOrder }
            : { transactionDate: sortOrder };

    const [items, total, totals] = await this.prisma.$transaction([
      this.prisma.financeAccountTransaction.findMany({
        where,
        include: {
          account: true,
          createdBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
        orderBy,
        skip,
        take,
      }),
      this.prisma.financeAccountTransaction.count({ where }),
      this.prisma.financeAccountTransaction.findMany({
        where,
        select: {
          id: true,
          accountId: true,
          amount: true,
          transactionType: true,
        },
      }),
    ]);

    const totalIn = round2(
      totals
        .filter((row) => isInboundType(row.transactionType))
        .reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
    );
    const totalOut = round2(
      totals
        .filter((row) => isOutboundType(row.transactionType))
        .reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
    );

    return {
      ...toPaginatedResponse({ items, total, page, limit }),
      summary: {
        transactionCount: totals.length,
        totalIn,
        totalOut,
        netChange: round2(totalIn - totalOut),
        accountCount: new Set(totals.map((row) => row.accountId)).size,
      },
    };
  }

  async create(dto: CreateFinanceAccountDto, userId: string) {
    const code = normalizeCode(dto.code);
    const existing = await this.prisma.financeAccount.findUnique({ where: { code } });
    if (existing) {
      throw new ConflictException('Finance account code already exists');
    }

    const openingBalance = round2(Number(dto.openingBalance ?? 0));
    const openingDate = normalizeDateOnly(dto.openingDate);

    const created = await this.prisma.$transaction(async (tx) => {
      const account = await tx.financeAccount.create({
        data: {
          code,
          name: dto.name.trim(),
          accountType: dto.accountType,
          currencyCode: normalizeCode(dto.currencyCode ?? 'EUR'),
          bankName: normalizeOptional(dto.bankName),
          bankAccountNo: normalizeOptional(dto.bankAccountNo),
          iban: normalizeOptional(dto.iban),
          swiftCode: normalizeOptional(dto.swiftCode),
          openingBalance,
          currentBalance: openingBalance,
          isActive: dto.isActive ?? true,
          notes: normalizeOptional(dto.notes),
        },
      });

      if (openingBalance !== 0) {
        await tx.financeAccountTransaction.create({
          data: {
            accountId: account.id,
            transactionType: FinanceAccountTransactionType.OPENING,
            amount: openingBalance,
            balanceBefore: 0,
            balanceAfter: openingBalance,
            transactionDate: openingDate,
            notes: 'Opening balance',
            createdById: userId,
          },
        });
      }

      return account;
    });

    await this.auditLogs.log({
      userId,
      entityType: 'finance_accounts',
      entityId: created.id,
      action: 'CREATE',
      metadata: {
        code: created.code,
        accountType: created.accountType,
        openingBalance,
      },
    });

    return created;
  }

  async createManualTransaction(dto: CreateFinanceAccountTransactionDto, userId: string) {
    const transactionDate = normalizeDateOnly(dto.transactionDate);
    const amount = round2(Number(dto.amount));
    const transactionType =
      dto.direction === 'IN'
        ? FinanceAccountTransactionType.MANUAL_IN
        : FinanceAccountTransactionType.MANUAL_OUT;

    return this.prisma.$transaction(async (tx) => {
      const created = await this.createAccountTransactionTx(tx, {
        accountId: dto.financeAccountId,
        amount,
        transactionType,
        transactionDate,
        referenceNo: dto.referenceNo,
        counterpartyName: dto.counterpartyName,
        notes: dto.notes,
        createdById: userId,
      });

      await tx.auditLog.create({
        data: {
          userId,
          entityType: 'finance_account_transactions',
          entityId: created.id,
          action: 'CREATE_MANUAL_TRANSACTION',
          metadata: {
            accountId: created.accountId,
            transactionType,
            amount,
            transactionDate: transactionDate.toISOString(),
            referenceNo: dto.referenceNo,
            counterpartyName: dto.counterpartyName,
          } as Prisma.InputJsonValue,
        },
      });

      return created;
    });
  }

  async createTransfer(dto: CreateFinanceTransferDto, userId: string) {
    if (dto.sourceAccountId === dto.destinationAccountId) {
      throw new BadRequestException('Source and destination account must be different');
    }

    const transactionDate = normalizeDateOnly(dto.transactionDate);
    const amount = round2(Number(dto.amount));
    const transferGroupId = randomUUID();

    return this.prisma.$transaction(async (tx) => {
      const source = await this.getAccountOrThrowTx(tx, dto.sourceAccountId);
      const destination = await this.getAccountOrThrowTx(tx, dto.destinationAccountId);

      const sourceTx = await this.createAccountTransactionTx(tx, {
        accountId: source.id,
        amount,
        transactionType: FinanceAccountTransactionType.TRANSFER_OUT,
        transactionDate,
        referenceNo: dto.referenceNo,
        notes: dto.notes,
        counterpartyName: destination.name,
        transferGroupId,
        createdById: userId,
      });

      const destinationTx = await this.createAccountTransactionTx(tx, {
        accountId: destination.id,
        amount,
        transactionType: FinanceAccountTransactionType.TRANSFER_IN,
        transactionDate,
        referenceNo: dto.referenceNo,
        notes: dto.notes,
        counterpartyName: source.name,
        transferGroupId,
        createdById: userId,
      });

      await tx.auditLog.create({
        data: {
          userId,
          entityType: 'finance_account_transfers',
          entityId: transferGroupId,
          action: 'CREATE',
          metadata: {
            sourceAccountId: source.id,
            sourceAccountCode: source.code,
            destinationAccountId: destination.id,
            destinationAccountCode: destination.code,
            amount,
            transactionDate: transactionDate.toISOString(),
            referenceNo: dto.referenceNo,
          } as Prisma.InputJsonValue,
        },
      });

      return {
        transferGroupId,
        amount,
        transactionDate,
        sourceTransaction: sourceTx,
        destinationTransaction: destinationTx,
      };
    });
  }

  async recordReceiptTransactionTx(
    tx: TransactionClient,
    params: {
      financeAccountId: string;
      amount: number;
      transactionDate: Date;
      createdById: string;
      referenceNo?: string;
      notes?: string;
      counterpartyName?: string;
      sourceDocumentId?: string;
      sourceDocumentNo?: string;
      financeSettlementId?: string;
      sourceAuditLogId?: string;
    },
  ) {
    return this.createAccountTransactionTx(tx, {
      accountId: params.financeAccountId,
      amount: round2(params.amount),
      transactionType: FinanceAccountTransactionType.RECEIPT,
      transactionDate: params.transactionDate,
      referenceNo: params.referenceNo,
      notes: params.notes,
      counterpartyName: params.counterpartyName,
      sourceDocumentType: 'sales-invoices',
      sourceDocumentId: params.sourceDocumentId,
      sourceDocumentNo: params.sourceDocumentNo,
      financeSettlementId: params.financeSettlementId,
      sourceAuditLogId: params.sourceAuditLogId,
      createdById: params.createdById,
    });
  }

  async recordPaymentTransactionTx(
    tx: TransactionClient,
    params: {
      financeAccountId: string;
      amount: number;
      transactionDate: Date;
      createdById: string;
      referenceNo?: string;
      notes?: string;
      counterpartyName?: string;
      sourceDocumentId?: string;
      sourceDocumentNo?: string;
      financeSettlementId?: string;
      sourceAuditLogId?: string;
    },
  ) {
    return this.createAccountTransactionTx(tx, {
      accountId: params.financeAccountId,
      amount: round2(params.amount),
      transactionType: FinanceAccountTransactionType.PAYMENT,
      transactionDate: params.transactionDate,
      referenceNo: params.referenceNo,
      notes: params.notes,
      counterpartyName: params.counterpartyName,
      sourceDocumentType: 'purchase-invoices',
      sourceDocumentId: params.sourceDocumentId,
      sourceDocumentNo: params.sourceDocumentNo,
      financeSettlementId: params.financeSettlementId,
      sourceAuditLogId: params.sourceAuditLogId,
      createdById: params.createdById,
    });
  }

  private async getAccountOrThrowTx(tx: TransactionClient, id: string) {
    const account = await tx.financeAccount.findUnique({ where: { id } });
    if (!account) {
      throw new NotFoundException('Finance account not found');
    }
    if (!account.isActive) {
      throw new BadRequestException('Finance account is inactive');
    }
    return account;
  }

  private async createAccountTransactionTx(
    tx: TransactionClient,
    params: {
      accountId: string;
      amount: number;
      transactionType: FinanceAccountTransactionType;
      transactionDate: Date;
      createdById: string;
      referenceNo?: string;
      notes?: string;
      counterpartyName?: string;
      sourceDocumentType?: string;
      sourceDocumentId?: string;
      sourceDocumentNo?: string;
      financeSettlementId?: string;
      sourceAuditLogId?: string;
      transferGroupId?: string;
    },
  ) {
    const account = await this.getAccountOrThrowTx(tx, params.accountId);
    const balanceBefore = round2(Number(account.currentBalance ?? 0));
    const signedAmount = isInboundType(params.transactionType) ? params.amount : -params.amount;
    const balanceAfter = round2(balanceBefore + signedAmount);

    await tx.financeAccount.update({
      where: { id: account.id },
      data: {
        currentBalance: balanceAfter,
      },
    });

    return tx.financeAccountTransaction.create({
      data: {
        accountId: account.id,
        financeSettlementId: params.financeSettlementId,
        sourceAuditLogId: params.sourceAuditLogId,
        transferGroupId: params.transferGroupId,
        transactionType: params.transactionType,
        amount: params.amount,
        balanceBefore,
        balanceAfter,
        transactionDate: params.transactionDate,
        referenceNo: normalizeOptional(params.referenceNo),
        counterpartyName: normalizeOptional(params.counterpartyName),
        sourceDocumentType: normalizeOptional(params.sourceDocumentType),
        sourceDocumentId: params.sourceDocumentId ?? null,
        sourceDocumentNo: normalizeOptional(params.sourceDocumentNo),
        notes: normalizeOptional(params.notes),
        createdById: params.createdById,
      },
      include: {
        account: true,
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });
  }
}
