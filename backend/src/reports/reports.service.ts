import { Injectable } from '@nestjs/common';
import { DocumentStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SalesReportQueryDto } from './dto/sales-report-query.dto';
import { AgingReportQueryDto } from './dto/aging-report-query.dto';
import { PaymentActivityQueryDto } from './dto/payment-activity-query.dto';
import { round2 } from '../common/utils/money';
import { calculateOutstandingAmount, resolveDueState } from '../common/utils/payments';

const RECEIVABLE_STATUSES = [
  DocumentStatus.POSTED,
  DocumentStatus.PARTIALLY_RETURNED,
  DocumentStatus.FULLY_RETURNED,
];

type AgingBucketKey = 'current' | 'days1To30' | 'days31To60' | 'days61To90' | 'days90Plus';
type PaymentActivityEntityType = 'sales_invoices' | 'purchase_invoices';
type PaymentActivityPartyKey = 'customer' | 'supplier';
type PaymentActivityItem = {
  id: string;
  documentId: string;
  docNo: string;
  docDate: Date;
  dueDate: Date | null;
  settlementTotal: number;
  currentOutstandingAmount: number;
  amount: number;
  paidAt: string;
  referenceNo: string | null;
  notes: string | null;
  remainingAmount: number;
  paymentStatusAfter: string | null;
  createdAt: Date;
  user: { id: string; fullName: string; email: string | null } | null;
  party: { id: string; name: string } | null;
};

function formatMonthLabel(key: string) {
  return new Intl.DateTimeFormat('sq-AL', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(`${key}-01T00:00:00.000Z`));
}

function resolveAgingBucket(daysPastDue: number): AgingBucketKey {
  if (daysPastDue <= 0) return 'current';
  if (daysPastDue <= 30) return 'days1To30';
  if (daysPastDue <= 60) return 'days31To60';
  if (daysPastDue <= 90) return 'days61To90';
  return 'days90Plus';
}

function startOfMonth(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function startOfDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function endOfDay(value: Date) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 23, 59, 59, 999),
  );
}

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

function parsePaymentMetadata(entry: { metadata?: unknown; createdAt: Date }) {
  const metadata =
    entry.metadata && typeof entry.metadata === 'object'
      ? (entry.metadata as Record<string, unknown>)
      : {};

  return {
    amount: Number(metadata.amount ?? 0),
    paidAt:
      typeof metadata.paidAt === 'string' && metadata.paidAt.trim().length > 0
        ? metadata.paidAt
        : entry.createdAt.toISOString(),
    referenceNo:
      typeof metadata.referenceNo === 'string' && metadata.referenceNo.trim().length > 0
        ? metadata.referenceNo
        : null,
    notes:
      typeof metadata.notes === 'string' && metadata.notes.trim().length > 0
        ? metadata.notes
        : null,
    remainingAmount: Number(metadata.remainingAmount ?? 0),
    paymentStatusAfter:
      typeof metadata.paymentStatusAfter === 'string' && metadata.paymentStatusAfter.trim().length > 0
        ? metadata.paymentStatusAfter
        : null,
  };
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildSalesWhere(query: SalesReportQueryDto) {
    const status =
      !query.status || query.status === 'ALL'
        ? DocumentStatus.POSTED
        : (query.status as DocumentStatus);

    return {
      status,
      docDate: {
        gte: query.dateFrom ? new Date(query.dateFrom) : undefined,
        lte: query.dateTo ? new Date(query.dateTo) : undefined,
      },
      customerId: query.customerId,
      createdById: query.userId,
    };
  }

  private calculateSalesSettlement(doc: {
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
    const amountPaid = Number(doc.amountPaid ?? 0);
    const outstandingAmount = calculateOutstandingAmount(settlementTotal, amountPaid);
    const { dueState, daysPastDue } = resolveDueState({
      dueDate: doc.dueDate,
      outstandingAmount,
      paymentStatus: doc.paymentStatus ?? (outstandingAmount <= 0 ? PaymentStatus.PAID : null),
    });

    return {
      creditedAmount,
      settlementTotal,
      amountPaid,
      outstandingAmount,
      dueState,
      daysPastDue,
    };
  }

  private calculatePurchaseSettlement(doc: {
    grandTotal: number | { toString(): string };
    amountPaid: number | { toString(): string };
    dueDate: Date | null;
    paymentStatus?: PaymentStatus | null;
  }) {
    const settlementTotal = round2(Number(doc.grandTotal ?? 0));
    const amountPaid = Number(doc.amountPaid ?? 0);
    const outstandingAmount = calculateOutstandingAmount(settlementTotal, amountPaid);
    const { dueState, daysPastDue } = resolveDueState({
      dueDate: doc.dueDate,
      outstandingAmount,
      paymentStatus: doc.paymentStatus ?? (outstandingAmount <= 0 ? PaymentStatus.PAID : null),
    });

    return {
      settlementTotal,
      amountPaid,
      outstandingAmount,
      dueState,
      daysPastDue,
    };
  }

  async getSalesSummary(query: SalesReportQueryDto) {
    const where = this.buildSalesWhere(query);
    const limitRecent = query.limitRecent ?? 100;

    const [totals, recentInvoices, groupedDays, groupedCustomers, groupedUsers] =
      await this.prisma.$transaction([
        this.prisma.salesInvoice.aggregate({
          where,
          _count: { _all: true },
          _sum: { grandTotal: true, subtotal: true, taxTotal: true },
        }),
        this.prisma.salesInvoice.findMany({
          where,
          include: {
            customer: { select: { id: true, name: true } },
            createdBy: { select: { id: true, fullName: true } },
          },
          orderBy: [{ docDate: 'desc' }, { createdAt: 'desc' }],
          take: limitRecent,
        }),
        (this.prisma.salesInvoice.groupBy as any)({
          by: ['docDate'],
          where,
          _sum: { grandTotal: true },
          orderBy: { docDate: 'asc' },
        }),
        (this.prisma.salesInvoice.groupBy as any)({
          by: ['customerId'],
          where,
          _sum: { grandTotal: true },
          _count: { _all: true },
        }),
        (this.prisma.salesInvoice.groupBy as any)({
          by: ['createdById'],
          where,
          _sum: { grandTotal: true },
          _count: { _all: true },
        }),
      ]);

    const customerIds = groupedCustomers
      .map((row) => row.customerId)
      .filter((value): value is string => Boolean(value));
    const userIds = groupedUsers
      .map((row) => row.createdById)
      .filter((value): value is string => Boolean(value));

    const [customers, users] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where: { id: { in: customerIds } },
        select: { id: true, name: true },
      }),
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, fullName: true },
      }),
    ]);

    const customerNameMap = new Map(customers.map((row) => [row.id, row.name]));
    const userNameMap = new Map(users.map((row) => [row.id, row.fullName]));

    const monthlyMap = new Map<string, number>();
    for (const row of groupedDays) {
      const monthKey = row.docDate.toISOString().slice(0, 7);
      monthlyMap.set(
        monthKey,
        Number(monthlyMap.get(monthKey) ?? 0) + Number(row._sum.grandTotal ?? 0),
      );
    }

    const monthly = Array.from(monthlyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([key, total]) => ({
        key,
        label: formatMonthLabel(key),
        total,
      }));

    const topCustomers = groupedCustomers
      .map((row) => ({
        customerId: row.customerId,
        name: row.customerId
          ? customerNameMap.get(row.customerId) ?? 'Klient i panjohur'
          : 'Pa klient',
        total: Number(row._sum.grandTotal ?? 0),
        count: row._count._all,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    const topAgents = groupedUsers
      .map((row) => ({
        userId: row.createdById,
        name: row.createdById
          ? userNameMap.get(row.createdById) ?? 'Perdorues i panjohur'
          : 'Pa agjent',
        total: Number(row._sum.grandTotal ?? 0),
        count: row._count._all,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    const count = totals._count._all ?? 0;
    const revenue = Number(totals._sum.grandTotal ?? 0);
    const netTotal = Number(totals._sum.subtotal ?? 0);
    const taxTotal = Number(totals._sum.taxTotal ?? 0);

    return {
      summary: {
        count,
        revenue,
        netTotal,
        taxTotal,
        avg: count > 0 ? revenue / count : 0,
      },
      monthly,
      topCustomers,
      topAgents,
      recentInvoices,
      appliedFilters: {
        ...query,
        status: !query.status || query.status === 'ALL' ? 'POSTED' : query.status,
      },
    };
  }

  async getReceivablesAging(query: AgingReportQueryDto) {
    const limit = query.limit ?? 200;
    const rows = await this.prisma.salesInvoice.findMany({
      where: {
        status: { in: RECEIVABLE_STATUSES },
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
        customer: { select: { id: true, name: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { docDate: 'asc' }],
      take: limit,
    });

    return this.buildAgingResponse(rows, 'customer');
  }

  async getPayablesAging(query: AgingReportQueryDto) {
    const limit = query.limit ?? 200;
    const rows = await this.prisma.purchaseInvoice.findMany({
      where: {
        status: { in: RECEIVABLE_STATUSES },
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
        supplier: { select: { id: true, name: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { docDate: 'asc' }],
      take: limit,
    });

    return this.buildAgingResponse(rows, 'supplier');
  }

  async getReceiptsActivity(query: PaymentActivityQueryDto = {}) {
    return this.getPaymentActivity({
      entityType: 'sales_invoices',
      partyKey: 'customer',
      query,
    });
  }

  async getSupplierPaymentsActivity(query: PaymentActivityQueryDto = {}) {
    return this.getPaymentActivity({
      entityType: 'purchase_invoices',
      partyKey: 'supplier',
      query,
    });
  }

  private async getPaymentActivity(params: {
    entityType: PaymentActivityEntityType;
    partyKey: PaymentActivityPartyKey;
    query: PaymentActivityQueryDto;
  }) {
    const where = {
      entityType: params.entityType,
      action: 'RECORD_PAYMENT',
    };

    const entries = await this.prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const documentIds = [...new Set(entries.map((entry) => entry.entityId))];

    if (documentIds.length === 0) {
      return this.buildPaymentActivityResponse({
        items: [],
        query: params.query,
        partyKey: params.partyKey,
      });
    }

    if (params.partyKey === 'customer') {
      const docs = await this.prisma.salesInvoice.findMany({
        where: { id: { in: documentIds } },
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
          customer: { select: { id: true, name: true } },
        },
      });

      const docMap = new Map(
        docs.map((doc) => {
          const state = this.calculateSalesSettlement(doc);
          return [
            doc.id,
            {
              ...doc,
              ...state,
            },
          ];
        }),
      );

      const items = this.buildPaymentActivityItems({
        entries,
        docMap,
        partyKey: params.partyKey,
      });

      return this.buildPaymentActivityResponse({
        items,
        query: params.query,
        partyKey: params.partyKey,
      });
    }

    const docs = await this.prisma.purchaseInvoice.findMany({
      where: { id: { in: documentIds } },
      select: {
        id: true,
        docNo: true,
        docDate: true,
        dueDate: true,
        grandTotal: true,
        amountPaid: true,
        paymentStatus: true,
        supplier: { select: { id: true, name: true } },
      },
    });

    const docMap = new Map(
      docs.map((doc) => {
        const state = this.calculatePurchaseSettlement(doc);
        return [
          doc.id,
          {
            ...doc,
            ...state,
          },
        ];
      }),
    );

    const items = this.buildPaymentActivityItems({
      entries,
      docMap,
      partyKey: params.partyKey,
    });

    return this.buildPaymentActivityResponse({
      items,
      query: params.query,
      partyKey: params.partyKey,
    });
  }

  private buildPaymentActivityItems(params: {
    entries: {
      id: string;
      entityId: string;
      metadata: unknown;
      createdAt: Date;
      user: { id: string; fullName: string; email: string | null } | null;
    }[];
    docMap: Map<
      string,
      {
        id: string;
        docNo: string;
        docDate: Date;
        dueDate: Date | null;
        outstandingAmount: number;
        settlementTotal: number;
        customer?: { id: string; name: string } | null;
        supplier?: { id: string; name: string } | null;
      }
    >;
    partyKey: PaymentActivityPartyKey;
  }) {
    return params.entries
      .map((entry) => {
        const doc = params.docMap.get(entry.entityId);
        if (!doc) return null;

        const metadata = parsePaymentMetadata(entry);

        return {
          id: entry.id,
          documentId: doc.id,
          docNo: doc.docNo,
          docDate: doc.docDate,
          dueDate: doc.dueDate,
          settlementTotal: doc.settlementTotal,
          currentOutstandingAmount: doc.outstandingAmount,
          amount: metadata.amount,
          paidAt: metadata.paidAt,
          referenceNo: metadata.referenceNo,
          notes: metadata.notes,
          remainingAmount: metadata.remainingAmount,
          paymentStatusAfter: metadata.paymentStatusAfter,
          createdAt: entry.createdAt,
          user: entry.user,
          party:
            params.partyKey === 'customer'
              ? doc.customer ?? null
              : doc.supplier ?? null,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
  }

  private buildPaymentActivityResponse(params: {
    items: PaymentActivityItem[];
    query: PaymentActivityQueryDto;
    partyKey: PaymentActivityPartyKey;
  }) {
    const search = params.query.search?.trim().toLowerCase() ?? '';
    const page = Math.max(params.query.page ?? 1, 1);
    const limit = Math.max(params.query.limit ?? 20, 1);
    const monthStart = startOfMonth(new Date());
    const dateFrom = params.query.dateFrom ? startOfDay(new Date(params.query.dateFrom)) : null;
    const dateTo = params.query.dateTo ? endOfDay(new Date(params.query.dateTo)) : null;
    const partyId =
      params.partyKey === 'customer' ? params.query.customerId : params.query.supplierId;

    const filteredItems = params.items.filter((row) => {
      const paidAt = toSafeDate(row.paidAt) ?? row.createdAt;

      if (partyId && row.party?.id !== partyId) {
        return false;
      }

      if (params.query.statusAfter && row.paymentStatusAfter !== params.query.statusAfter) {
        return false;
      }

      if (params.query.minAmount !== undefined && row.amount < params.query.minAmount) {
        return false;
      }

      if (params.query.maxAmount !== undefined && row.amount > params.query.maxAmount) {
        return false;
      }

      if (dateFrom && (!paidAt || paidAt < dateFrom)) {
        return false;
      }

      if (dateTo && (!paidAt || paidAt > dateTo)) {
        return false;
      }

      if (!search) {
        return true;
      }

      const searchable = [
        row.docNo,
        row.party?.name,
        row.referenceNo,
        row.notes,
        row.user?.fullName,
        row.user?.email,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchable.includes(search);
    });

    const direction = params.query.sortOrder === 'asc' ? 1 : -1;
    const sortBy = params.query.sortBy ?? 'paidAt';

    const sortedItems = [...filteredItems].sort((left, right) => {
      let comparison = 0;

      switch (sortBy) {
        case 'amount':
          comparison = left.amount - right.amount;
          break;
        case 'remainingAmount':
          comparison = left.remainingAmount - right.remainingAmount;
          break;
        case 'currentOutstandingAmount':
          comparison = left.currentOutstandingAmount - right.currentOutstandingAmount;
          break;
        case 'docDate':
          comparison = compareNullableDates(left.docDate, right.docDate);
          break;
        case 'dueDate':
          comparison = compareNullableDates(left.dueDate, right.dueDate);
          break;
        case 'docNo':
          comparison = compareStrings(left.docNo, right.docNo);
          break;
        case 'party':
          comparison = compareStrings(left.party?.name, right.party?.name);
          break;
        case 'referenceNo':
          comparison = compareStrings(left.referenceNo, right.referenceNo);
          break;
        case 'statusAfter':
          comparison = compareStrings(left.paymentStatusAfter, right.paymentStatusAfter);
          break;
        case 'createdAt':
          comparison = compareNullableDates(left.createdAt, right.createdAt);
          break;
        default:
          comparison = compareNullableDates(left.paidAt, right.paidAt);
          break;
      }

      if (comparison === 0) {
        comparison = compareNullableDates(left.paidAt, right.paidAt);
      }

      if (comparison === 0) {
        comparison = compareStrings(left.docNo, right.docNo);
      }

      return comparison * direction;
    });

    const total = sortedItems.length;
    const totalAmount = round2(sortedItems.reduce((sum, row) => sum + row.amount, 0));
    const pageCount = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, pageCount);
    const skip = (safePage - 1) * limit;
    const items = sortedItems.slice(skip, skip + limit);

    const monthSummary = sortedItems.reduce(
      (acc, row) => {
        const paidAt = toSafeDate(row.paidAt) ?? row.createdAt;
        if (paidAt && paidAt >= monthStart) {
          acc.totalAmount += row.amount;
          acc.count += 1;
        }
        return acc;
      },
      { totalAmount: 0, count: 0 },
    );

    return {
      summary: {
        count: total,
        visibleCount: items.length,
        visibleAmount: round2(items.reduce((sum, row) => sum + row.amount, 0)),
        totalAmount,
        currentMonthAmount: round2(monthSummary.totalAmount),
        currentMonthCount: monthSummary.count,
      },
      items,
      page: safePage,
      limit,
      total,
      pageCount,
    };
  }

  private buildAgingResponse<
    T extends {
      id: string;
      docNo: string;
      docDate: Date;
      dueDate: Date | null;
      grandTotal: number | { toString(): string };
      amountPaid: number | { toString(): string };
      paymentStatus?: PaymentStatus | null;
      returns?: { grandTotal: number | { toString(): string } }[];
      customer?: { id: string; name: string } | null;
      supplier?: { id: string; name: string } | null;
    },
  >(rows: T[], partyKey: PaymentActivityPartyKey) {
    const today = new Date();
    const summary: Record<AgingBucketKey, number> = {
      current: 0,
      days1To30: 0,
      days31To60: 0,
      days61To90: 0,
      days90Plus: 0,
    };

    const items = rows
      .map((row) => {
        const settlement =
          partyKey === 'customer'
            ? this.calculateSalesSettlement({
                grandTotal: row.grandTotal,
                amountPaid: row.amountPaid,
                dueDate: row.dueDate,
                paymentStatus: row.paymentStatus,
                returns: row.returns,
              })
            : this.calculatePurchaseSettlement({
                grandTotal: row.grandTotal,
                amountPaid: row.amountPaid,
                dueDate: row.dueDate,
                paymentStatus: row.paymentStatus,
              });

        const dueDate = row.dueDate ?? row.docDate;
        const { dueState, daysPastDue } = resolveDueState({
          dueDate,
          outstandingAmount: settlement.outstandingAmount,
          paymentStatus:
            settlement.outstandingAmount <= 0 ? PaymentStatus.PAID : PaymentStatus.UNPAID,
          today,
        });

        const bucket = resolveAgingBucket(daysPastDue);
        summary[bucket] += settlement.outstandingAmount;

        return {
          id: row.id,
          docNo: row.docNo,
          docDate: row.docDate,
          dueDate,
          total: settlement.settlementTotal,
          paid: settlement.amountPaid,
          daysPastDue,
          outstanding: settlement.outstandingAmount,
          dueState,
          party: partyKey === 'customer' ? row.customer ?? null : row.supplier ?? null,
        };
      })
      .filter((row) => row.outstanding > 0);

    return {
      summary,
      totalOutstanding: Object.values(summary).reduce((total, amount) => total + amount, 0),
      openCount: items.length,
      overdueCount: items.filter((row) => row.dueState === 'OVERDUE').length,
      items,
    };
  }
}
