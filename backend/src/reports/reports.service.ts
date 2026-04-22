import { Injectable } from '@nestjs/common';
import { DocumentStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SalesReportQueryDto } from './dto/sales-report-query.dto';
import { AgingReportQueryDto } from './dto/aging-report-query.dto';
import { PaymentActivityQueryDto } from './dto/payment-activity-query.dto';
import { round2 } from '../common/utils/money';
import {
  calculateOutstandingAmount,
  resolveDueState,
  resolvePaymentStatus,
} from '../common/utils/payments';

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

type AgingReportItem = {
  id: string;
  docNo: string;
  docDate: Date;
  dueDate: Date | null;
  total: number;
  paid: number;
  daysPastDue: number;
  outstanding: number;
  dueState: string;
  paymentStatus: string | null;
  party: { id: string; name: string } | null;
};

type ExposureReportItem = {
  party: { id: string; name: string } | null;
  openCount: number;
  overdueCount: number;
  dueTodayCount: number;
  unpaidCount: number;
  partiallyPaidCount: number;
  totalOutstanding: number;
  overdueOutstanding: number;
  dueTodayOutstanding: number;
  currentOutstanding: number;
  maxDaysPastDue: number;
  oldestDueDate: Date | null;
  newestDocDate: Date | null;
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
      paymentStatus:
        doc.paymentStatus ?? resolvePaymentStatus(settlementTotal, amountPaid),
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
      paymentStatus:
        doc.paymentStatus ?? resolvePaymentStatus(settlementTotal, amountPaid),
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
      where: this.buildAgingWhere(query, 'customer'),
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

    return this.buildAgingResponse(rows, 'customer', limit, query);
  }

  async getReceivablesExposure(query: AgingReportQueryDto) {
    const limit = query.limit ?? 20;
    const rows = await this.prisma.salesInvoice.findMany({
      where: this.buildAgingWhere(query, 'customer'),
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

    return this.buildExposureResponse(rows, 'customer', limit, query);
  }

  async getPayablesAging(query: AgingReportQueryDto) {
    const limit = query.limit ?? 200;
    const rows = await this.prisma.purchaseInvoice.findMany({
      where: this.buildAgingWhere(query, 'supplier'),
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

    return this.buildAgingResponse(rows, 'supplier', limit, query);
  }

  async getPayablesExposure(query: AgingReportQueryDto) {
    const limit = query.limit ?? 20;
    const rows = await this.prisma.purchaseInvoice.findMany({
      where: this.buildAgingWhere(query, 'supplier'),
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

    return this.buildExposureResponse(rows, 'supplier', limit, query);
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

  private buildAgingWhere(query: AgingReportQueryDto, partyKey: PaymentActivityPartyKey) {
    const search = query.search?.trim();
    const partyRelation = partyKey === 'customer' ? 'customer' : 'supplier';

    return {
      status: { in: RECEIVABLE_STATUSES },
      paymentStatus:
        query.paymentStatus && query.paymentStatus !== 'ALL'
          ? (query.paymentStatus as PaymentStatus)
          : { not: PaymentStatus.PAID },
      ...(partyKey === 'customer'
        ? { customerId: query.customerId }
        : { supplierId: query.supplierId }),
      ...(search
        ? {
            OR: [
              { docNo: { contains: search, mode: 'insensitive' as const } },
              {
                [partyRelation]: {
                  name: { contains: search, mode: 'insensitive' as const },
                },
              },
            ],
          }
        : {}),
    };
  }

  private buildAgingItems<
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

    return rows
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
            settlement.outstandingAmount <= 0
              ? PaymentStatus.PAID
              : (settlement.paymentStatus ?? PaymentStatus.UNPAID),
          today,
        });

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
          paymentStatus: settlement.paymentStatus ?? PaymentStatus.UNPAID,
          party: partyKey === 'customer' ? row.customer ?? null : row.supplier ?? null,
        } satisfies AgingReportItem;
      })
      .filter((row) => row.outstanding > 0);
  }

  private filterAgingItems(
    items: AgingReportItem[],
    query: AgingReportQueryDto,
    partyKey: PaymentActivityPartyKey,
  ) {
    const search = query.search?.trim().toLowerCase() ?? '';
    const partyId = partyKey === 'customer' ? query.customerId : query.supplierId;

    return items.filter((row) => {
      if (partyId && row.party?.id !== partyId) {
        return false;
      }

      if (query.dueState && query.dueState !== 'ALL' && row.dueState !== query.dueState) {
        return false;
      }

      if (
        query.paymentStatus &&
        query.paymentStatus !== 'ALL' &&
        row.paymentStatus !== query.paymentStatus
      ) {
        return false;
      }

      if (query.minOutstanding !== undefined && row.outstanding < query.minOutstanding) {
        return false;
      }

      if (query.maxOutstanding !== undefined && row.outstanding > query.maxOutstanding) {
        return false;
      }

      if (!search) {
        return true;
      }

      const searchable = [row.docNo, row.party?.name, row.paymentStatus, row.dueState]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchable.includes(search);
    });
  }

  private sortAgingItems(items: AgingReportItem[], query: AgingReportQueryDto) {
    const direction = query.sortOrder === 'asc' ? 1 : -1;
    const sortBy = query.sortBy ?? 'daysPastDue';

    return [...items].sort((left, right) => {
      let comparison = 0;

      switch (sortBy) {
        case 'outstanding':
          comparison = left.outstanding - right.outstanding;
          break;
        case 'total':
          comparison = left.total - right.total;
          break;
        case 'paid':
          comparison = left.paid - right.paid;
          break;
        case 'docDate':
          comparison = compareNullableDates(left.docDate, right.docDate);
          break;
        case 'dueDate':
          comparison = compareNullableDates(left.dueDate, right.dueDate);
          break;
        case 'party':
          comparison = compareStrings(left.party?.name, right.party?.name);
          break;
        case 'docNo':
          comparison = compareStrings(left.docNo, right.docNo);
          break;
        case 'paymentStatus':
          comparison = compareStrings(left.paymentStatus, right.paymentStatus);
          break;
        default:
          comparison = left.daysPastDue - right.daysPastDue;
          break;
      }

      if (comparison === 0) {
        comparison = compareNullableDates(left.dueDate, right.dueDate);
      }

      if (comparison === 0) {
        comparison = compareStrings(left.docNo, right.docNo);
      }

      return comparison * direction;
    });
  }

  private buildExposureItems(items: AgingReportItem[]) {
    const groups = new Map<string, ExposureReportItem>();

    for (const row of items) {
      const key = row.party?.id ?? `unknown:${row.party?.name ?? 'Pa subjekt'}`;
      const existing = groups.get(key) ?? {
        party: row.party ?? null,
        openCount: 0,
        overdueCount: 0,
        dueTodayCount: 0,
        unpaidCount: 0,
        partiallyPaidCount: 0,
        totalOutstanding: 0,
        overdueOutstanding: 0,
        dueTodayOutstanding: 0,
        currentOutstanding: 0,
        maxDaysPastDue: 0,
        oldestDueDate: null,
        newestDocDate: null,
      };

      existing.openCount += 1;
      existing.totalOutstanding += row.outstanding;
      existing.maxDaysPastDue = Math.max(existing.maxDaysPastDue, row.daysPastDue);
      existing.oldestDueDate =
        !existing.oldestDueDate || compareNullableDates(row.dueDate, existing.oldestDueDate) < 0
          ? row.dueDate
          : existing.oldestDueDate;
      existing.newestDocDate =
        !existing.newestDocDate || compareNullableDates(row.docDate, existing.newestDocDate) > 0
          ? row.docDate
          : existing.newestDocDate;

      if (row.paymentStatus === PaymentStatus.UNPAID) {
        existing.unpaidCount += 1;
      }

      if (row.paymentStatus === PaymentStatus.PARTIALLY_PAID) {
        existing.partiallyPaidCount += 1;
      }

      if (row.dueState === 'OVERDUE') {
        existing.overdueCount += 1;
        existing.overdueOutstanding += row.outstanding;
      } else if (row.dueState === 'DUE_TODAY') {
        existing.dueTodayCount += 1;
        existing.dueTodayOutstanding += row.outstanding;
      } else {
        existing.currentOutstanding += row.outstanding;
      }

      groups.set(key, existing);
    }

    return Array.from(groups.values()).map((row) => ({
      ...row,
      totalOutstanding: round2(row.totalOutstanding),
      overdueOutstanding: round2(row.overdueOutstanding),
      dueTodayOutstanding: round2(row.dueTodayOutstanding),
      currentOutstanding: round2(row.currentOutstanding),
    }));
  }

  private sortExposureItems(items: ExposureReportItem[], query: AgingReportQueryDto) {
    const direction = query.sortOrder === 'asc' ? 1 : -1;
    const sortBy = query.sortBy ?? 'totalOutstanding';

    return [...items].sort((left, right) => {
      let comparison = 0;

      switch (sortBy) {
        case 'party':
          comparison = compareStrings(left.party?.name, right.party?.name);
          break;
        case 'openCount':
          comparison = left.openCount - right.openCount;
          break;
        case 'overdueCount':
          comparison = left.overdueCount - right.overdueCount;
          break;
        case 'overdueOutstanding':
          comparison = left.overdueOutstanding - right.overdueOutstanding;
          break;
        case 'currentOutstanding':
          comparison = left.currentOutstanding - right.currentOutstanding;
          break;
        case 'maxDaysPastDue':
          comparison = left.maxDaysPastDue - right.maxDaysPastDue;
          break;
        default:
          comparison = left.totalOutstanding - right.totalOutstanding;
          break;
      }

      if (comparison === 0) {
        comparison = compareStrings(left.party?.name, right.party?.name);
      }

      return comparison * direction;
    });
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
  >(rows: T[], partyKey: PaymentActivityPartyKey, limit: number, query: AgingReportQueryDto) {
    const filteredItems = this.filterAgingItems(this.buildAgingItems(rows, partyKey), query, partyKey);
    const sortedItems = this.sortAgingItems(filteredItems, query);
    const visibleItems = sortedItems.slice(0, limit);
    const summary: Record<AgingBucketKey, number> = {
      current: 0,
      days1To30: 0,
      days31To60: 0,
      days61To90: 0,
      days90Plus: 0,
    };

    for (const row of filteredItems) {
      const bucket = resolveAgingBucket(row.daysPastDue);
      summary[bucket] += row.outstanding;
    }

    return {
      summary,
      totalOutstanding: round2(
        Object.values(summary).reduce((total, amount) => total + amount, 0),
      ),
      openCount: filteredItems.length,
      visibleCount: visibleItems.length,
      overdueCount: filteredItems.filter((row) => row.dueState === 'OVERDUE').length,
      truncated: filteredItems.length > visibleItems.length,
      items: visibleItems,
    };
  }

  private buildExposureResponse<
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
  >(rows: T[], partyKey: PaymentActivityPartyKey, limit: number, query: AgingReportQueryDto) {
    const filteredItems = this.filterAgingItems(this.buildAgingItems(rows, partyKey), query, partyKey);
    const exposures = this.sortExposureItems(this.buildExposureItems(filteredItems), query);
    const visibleItems = exposures.slice(0, limit);

    return {
      summary: {
        partyCount: exposures.length,
        overduePartyCount: exposures.filter((row) => row.overdueCount > 0).length,
        documentCount: filteredItems.length,
        totalOutstanding: round2(
          exposures.reduce((total, row) => total + row.totalOutstanding, 0),
        ),
        overdueOutstanding: round2(
          exposures.reduce((total, row) => total + row.overdueOutstanding, 0),
        ),
        dueTodayOutstanding: round2(
          exposures.reduce((total, row) => total + row.dueTodayOutstanding, 0),
        ),
        currentOutstanding: round2(
          exposures.reduce((total, row) => total + row.currentOutstanding, 0),
        ),
      },
      visibleCount: visibleItems.length,
      truncated: exposures.length > visibleItems.length,
      items: visibleItems,
    };
  }
}
