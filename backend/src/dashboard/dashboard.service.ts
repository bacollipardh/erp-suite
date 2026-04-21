import { Injectable } from '@nestjs/common';
import { DocumentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const ACTIVE_DOCUMENT_STATUSES = [
  DocumentStatus.POSTED,
  DocumentStatus.PARTIALLY_RETURNED,
  DocumentStatus.FULLY_RETURNED,
];

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const [itemsCount, suppliersCount, customersCount, stockLinesCount] = await this.prisma.$transaction([
      this.prisma.item.count(),
      this.prisma.supplier.count(),
      this.prisma.customer.count(),
      this.prisma.stockBalance.count(),
    ]);

    const [purchaseInvoicesCount, salesInvoicesCount, salesReturnsCount] = await this.prisma.$transaction([
      this.prisma.purchaseInvoice.count(),
      this.prisma.salesInvoice.count(),
      this.prisma.salesReturn.count(),
    ]);

    const [purchaseTotals, salesTotals, salesReturnTotals] = await this.prisma.$transaction([
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
    ]);

    const postedPurchases = Number(purchaseTotals._sum.grandTotal ?? 0);
    const postedSales = Number(salesTotals._sum.grandTotal ?? 0);
    const postedReturns = Number(salesReturnTotals._sum.grandTotal ?? 0);
    const outstandingReceivables = Math.max(
      0,
      postedSales - Number(salesTotals._sum.amountPaid ?? 0),
    );
    const outstandingPayables = Math.max(
      0,
      postedPurchases - Number(purchaseTotals._sum.amountPaid ?? 0),
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
        receivables: outstandingReceivables,
        payables: outstandingPayables,
      },
    };
  }
}
