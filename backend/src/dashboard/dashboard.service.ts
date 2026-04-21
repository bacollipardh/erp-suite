import { Injectable } from '@nestjs/common';
import { DocumentStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { round2 } from '../common/utils/money';
import { calculateOutstandingAmount, resolveDueState } from '../common/utils/payments';

const ACTIVE_DOCUMENT_STATUSES = [
  DocumentStatus.POSTED,
  DocumentStatus.PARTIALLY_RETURNED,
  DocumentStatus.FULLY_RETURNED,
];

function startOfMonth(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private summarizeReceivables(
    rows: {
      grandTotal: number | { toString(): string };
      amountPaid: number | { toString(): string };
      dueDate: Date | null;
      paymentStatus: PaymentStatus;
      returns: { grandTotal: number | { toString(): string } }[];
    }[],
  ) {
    return rows.reduce(
      (summary, row) => {
        const creditedAmount = round2(
          row.returns.reduce((sum, entry) => sum + Number(entry.grandTotal ?? 0), 0),
        );
        const settlementTotal = round2(Math.max(0, Number(row.grandTotal ?? 0) - creditedAmount));
        const outstandingAmount = calculateOutstandingAmount(
          settlementTotal,
          Number(row.amountPaid ?? 0),
        );

        if (outstandingAmount <= 0) return summary;

        const { dueState } = resolveDueState({
          dueDate: row.dueDate,
          outstandingAmount,
          paymentStatus: row.paymentStatus,
        });

        summary.totalOutstanding += outstandingAmount;
        summary.openCount += 1;

        if (dueState === 'OVERDUE') summary.overdueCount += 1;
        if (dueState === 'DUE_TODAY') summary.dueTodayCount += 1;
        if (dueState === 'CURRENT') summary.currentCount += 1;

        return summary;
      },
      {
        totalOutstanding: 0,
        openCount: 0,
        overdueCount: 0,
        dueTodayCount: 0,
        currentCount: 0,
      },
    );
  }

  private summarizePayables(
    rows: {
      grandTotal: number | { toString(): string };
      amountPaid: number | { toString(): string };
      dueDate: Date | null;
      paymentStatus: PaymentStatus;
    }[],
  ) {
    return rows.reduce(
      (summary, row) => {
        const outstandingAmount = calculateOutstandingAmount(
          Number(row.grandTotal ?? 0),
          Number(row.amountPaid ?? 0),
        );

        if (outstandingAmount <= 0) return summary;

        const { dueState } = resolveDueState({
          dueDate: row.dueDate,
          outstandingAmount,
          paymentStatus: row.paymentStatus,
        });

        summary.totalOutstanding += outstandingAmount;
        summary.openCount += 1;

        if (dueState === 'OVERDUE') summary.overdueCount += 1;
        if (dueState === 'DUE_TODAY') summary.dueTodayCount += 1;
        if (dueState === 'CURRENT') summary.currentCount += 1;

        return summary;
      },
      {
        totalOutstanding: 0,
        openCount: 0,
        overdueCount: 0,
        dueTodayCount: 0,
        currentCount: 0,
      },
    );
  }

  async getSummary() {
    const monthStart = startOfMonth(new Date());

    const [itemsCount, suppliersCount, customersCount, stockLinesCount] =
      await this.prisma.$transaction([
        this.prisma.item.count(),
        this.prisma.supplier.count(),
        this.prisma.customer.count(),
        this.prisma.stockBalance.count(),
      ]);

    const [purchaseInvoicesCount, salesInvoicesCount, salesReturnsCount] =
      await this.prisma.$transaction([
        this.prisma.purchaseInvoice.count(),
        this.prisma.salesInvoice.count(),
        this.prisma.salesReturn.count(),
      ]);

    const [
      purchaseTotals,
      salesTotals,
      salesReturnTotals,
      openReceivableDocs,
      openPayableDocs,
      receiptLogs,
      paymentLogs,
    ] = await this.prisma.$transaction([
      this.prisma.purchaseInvoice.aggregate({
        where: { status: { in: ACTIVE_DOCUMENT_STATUSES } },
        _sum: { grandTotal: true, amountPaid: true },
      }),
      this.prisma.salesInvoice.aggregate({
        where: { status: { in: ACTIVE_DOCUMENT_STATUSES } },
        _sum: { grandTotal: true, amountPaid: true },
      }),
      this.prisma.salesReturn.aggregate({
        where: { status: { in: ACTIVE_DOCUMENT_STATUSES } },
        _sum: { grandTotal: true },
      }),
      this.prisma.salesInvoice.findMany({
        where: {
          status: { in: ACTIVE_DOCUMENT_STATUSES },
          paymentStatus: { not: PaymentStatus.PAID },
        },
        select: {
          grandTotal: true,
          amountPaid: true,
          dueDate: true,
          paymentStatus: true,
          returns: {
            where: { status: DocumentStatus.POSTED },
            select: { grandTotal: true },
          },
        },
      }),
      this.prisma.purchaseInvoice.findMany({
        where: {
          status: { in: ACTIVE_DOCUMENT_STATUSES },
          paymentStatus: { not: PaymentStatus.PAID },
        },
        select: {
          grandTotal: true,
          amountPaid: true,
          dueDate: true,
          paymentStatus: true,
        },
      }),
      this.prisma.auditLog.findMany({
        where: {
          entityType: 'sales_invoices',
          action: 'RECORD_PAYMENT',
          createdAt: { gte: monthStart },
        },
        select: { metadata: true },
      }),
      this.prisma.auditLog.findMany({
        where: {
          entityType: 'purchase_invoices',
          action: 'RECORD_PAYMENT',
          createdAt: { gte: monthStart },
        },
        select: { metadata: true },
      }),
    ]);

    const postedPurchases = Number(purchaseTotals._sum.grandTotal ?? 0);
    const postedSales = Number(salesTotals._sum.grandTotal ?? 0);
    const postedReturns = Number(salesReturnTotals._sum.grandTotal ?? 0);

    const receivables = this.summarizeReceivables(openReceivableDocs);
    const payables = this.summarizePayables(openPayableDocs);

    const receiptsMonth = round2(
      receiptLogs.reduce((sum, entry) => {
        const metadata =
          entry.metadata && typeof entry.metadata === 'object'
            ? (entry.metadata as Record<string, unknown>)
            : {};
        return sum + Number(metadata.amount ?? 0);
      }, 0),
    );

    const paymentsMonth = round2(
      paymentLogs.reduce((sum, entry) => {
        const metadata =
          entry.metadata && typeof entry.metadata === 'object'
            ? (entry.metadata as Record<string, unknown>)
            : {};
        return sum + Number(metadata.amount ?? 0);
      }, 0),
    );

    return {
      counts: {
        items: itemsCount,
        suppliers: suppliersCount,
        customers: customersCount,
        stockLines: stockLinesCount,
        purchaseInvoices: purchaseInvoicesCount,
        salesInvoices: salesInvoicesCount,
        salesReturns: salesReturnsCount,
      },
      totals: {
        postedPurchases,
        postedSales,
        postedReturns,
      },
      outstanding: {
        receivables: round2(receivables.totalOutstanding),
        payables: round2(payables.totalOutstanding),
      },
      aging: {
        receivables,
        payables,
      },
      cashflow: {
        receiptsMonth,
        paymentsMonth,
      },
    };
  }
}
