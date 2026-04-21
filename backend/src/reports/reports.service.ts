import { Injectable } from '@nestjs/common';
import { DocumentStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SalesReportQueryDto } from './dto/sales-report-query.dto';
import { AgingReportQueryDto } from './dto/aging-report-query.dto';
import { calculateOutstandingAmount, resolveDueState } from '../common/utils/payments';

const RECEIVABLE_STATUSES = [
  DocumentStatus.POSTED,
  DocumentStatus.PARTIALLY_RETURNED,
  DocumentStatus.FULLY_RETURNED,
];

type AgingBucketKey = 'current' | 'days1To30' | 'days31To60' | 'days61To90' | 'days90Plus';

function formatMonthLabel(key: string) {
  return new Date(`${key}-01`).toLocaleDateString('sq-AL', {
    month: 'short',
    year: '2-digit',
  });
}

function resolveAgingBucket(daysPastDue: number): AgingBucketKey {
  if (daysPastDue <= 0) return 'current';
  if (daysPastDue <= 30) return 'days1To30';
  if (daysPastDue <= 60) return 'days31To60';
  if (daysPastDue <= 90) return 'days61To90';
  return 'days90Plus';
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
        name: row.customerId ? customerNameMap.get(row.customerId) ?? 'Klient i panjohur' : 'Pa klient',
        total: Number(row._sum.grandTotal ?? 0),
        count: row._count._all,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    const topAgents = groupedUsers
      .map((row) => ({
        userId: row.createdById,
        name: row.createdById ? userNameMap.get(row.createdById) ?? 'Përdorues i panjohur' : 'Pa agjent',
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
        supplier: { select: { id: true, name: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { docDate: 'asc' }],
      take: limit,
    });

    return this.buildAgingResponse(rows, 'supplier');
  }

  private buildAgingResponse<
    T extends {
      id: string;
      docNo: string;
      docDate: Date;
      dueDate: Date | null;
      grandTotal: number | { toString(): string };
      amountPaid: number | { toString(): string };
      returns?: { grandTotal: number | { toString(): string } }[];
      customer?: { id: string; name: string } | null;
      supplier?: { id: string; name: string } | null;
    },
  >(rows: T[], partyKey: 'customer' | 'supplier') {
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
        const credited =
          partyKey === 'customer'
            ? (row.returns ?? []).reduce((sum, entry) => sum + Number(entry.grandTotal ?? 0), 0)
            : 0;
        const total = Math.max(0, Number(row.grandTotal ?? 0) - credited);
        const paid = Number(row.amountPaid ?? 0);
        const outstanding = calculateOutstandingAmount(total, paid);
        const dueDate = row.dueDate ?? row.docDate;
        const { dueState, daysPastDue } = resolveDueState({
          dueDate,
          outstandingAmount: outstanding,
          paymentStatus: outstanding <= 0 ? PaymentStatus.PAID : PaymentStatus.UNPAID,
          today,
        });
        const bucket = resolveAgingBucket(daysPastDue);
        summary[bucket] += outstanding;

        return {
          id: row.id,
          docNo: row.docNo,
          docDate: row.docDate,
          dueDate,
          total,
          paid,
          daysPastDue,
          outstanding,
          dueState,
          party:
            partyKey === 'customer'
              ? row.customer ?? null
              : row.supplier ?? null,
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
