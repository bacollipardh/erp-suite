import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DocumentStatus } from '@prisma/client';
import { AccountingService } from '../accounting/accounting.service';
import { SalesReturnsService } from '../sales-returns/sales-returns.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { FinancialPeriodsService } from '../financial-periods/financial-periods.service';
import { StockService } from '../stock/stock.service';

const mockTx = {
  documentSeries: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  customer: {
    findUnique: jest.fn(),
  },
  salesInvoice: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  salesInvoiceLine: {
    findMany: jest.fn(),
  },
  salesReturnLine: {
    aggregate: jest.fn(),
    deleteMany: jest.fn(),
  },
  salesReturn: {
    create: jest.fn(),
    update: jest.fn(),
  },
  stockBalance: {
    findUnique: jest.fn(),
  },
};

const mockPrisma = {
  $transaction: jest.fn(),
  salesReturn: {
    findUnique: jest.fn(),
  },
};

const mockAuditLogs = {
  log: jest.fn(),
};

const mockStockService = {
  applyMovement: jest.fn(),
};

const mockFinancialPeriodsService = {
  assertDateOpen: jest.fn().mockResolvedValue(null),
};

const mockAccountingService = {
  postSalesReturnTx: jest.fn(),
};

describe('SalesReturnsService', () => {
  let service: SalesReturnsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesReturnsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditLogsService, useValue: mockAuditLogs },
        { provide: StockService, useValue: mockStockService },
        { provide: FinancialPeriodsService, useValue: mockFinancialPeriodsService },
        { provide: AccountingService, useValue: mockAccountingService },
      ],
    }).compile();

    service = module.get<SalesReturnsService>(SalesReturnsService);

    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockTx) => unknown) =>
      callback(mockTx),
    );

    jest.clearAllMocks();
    mockFinancialPeriodsService.assertDateOpen.mockResolvedValue(null);
  });

  it('stores return pricing from the source sales invoice line', async () => {
    mockTx.documentSeries.findUnique.mockResolvedValue({
      id: 'series-1',
      prefix: 'KR',
      nextNumber: 7,
      documentType: 'SALES_RETURN',
      isActive: true,
    });
    mockTx.customer.findUnique.mockResolvedValue({ id: 'customer-1', isActive: true });
    mockTx.salesInvoice.findUnique.mockResolvedValue({
      id: 'invoice-1',
      customerId: 'customer-1',
      status: DocumentStatus.POSTED,
      warehouseId: 'warehouse-1',
      docNo: 'SH-0001',
    });
    mockTx.salesInvoiceLine.findMany.mockResolvedValue([
      {
        id: 'source-line-1',
        salesInvoiceId: 'invoice-1',
        itemId: 'item-from-source',
        qty: 5,
        unitPrice: 12.5,
        taxPercent: 18,
      },
    ]);
    mockTx.salesReturnLine.aggregate.mockResolvedValue({ _sum: { qty: 1 } });
    mockTx.salesReturn.create.mockResolvedValue({
      id: 'return-1',
      docNo: 'KR-0007',
    });
    mockTx.documentSeries.update.mockResolvedValue({});

    await service.create(
      {
        seriesId: 'series-1',
        salesInvoiceId: 'invoice-1',
        customerId: 'customer-1',
        docDate: '2026-04-21',
        lines: [
          {
            salesInvoiceLineId: 'source-line-1',
            qty: 2,
            unitPrice: 999,
            taxPercent: 0,
          },
        ],
      },
      'user-1',
    );

    expect(mockTx.salesReturnLine.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          salesInvoiceLineId: 'source-line-1',
          salesReturn: expect.objectContaining({ status: DocumentStatus.POSTED }),
        }),
      }),
    );
    expect(mockTx.salesReturn.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lines: {
            create: [
              expect.objectContaining({
                salesInvoiceLineId: 'source-line-1',
                itemId: 'item-from-source',
                qty: 2,
                unitPrice: 12.5,
                taxPercent: 18,
              }),
            ],
          },
        }),
      }),
    );
    expect(mockAuditLogs.log).toHaveBeenCalled();
  });

  it('rejects a source line that belongs to another sales invoice', async () => {
    mockTx.documentSeries.findUnique.mockResolvedValue({
      id: 'series-1',
      prefix: 'KR',
      nextNumber: 7,
      documentType: 'SALES_RETURN',
      isActive: true,
    });
    mockTx.customer.findUnique.mockResolvedValue({ id: 'customer-1', isActive: true });
    mockTx.salesInvoice.findUnique.mockResolvedValue({
      id: 'invoice-1',
      customerId: 'customer-1',
      status: DocumentStatus.POSTED,
      warehouseId: 'warehouse-1',
      docNo: 'SH-0001',
    });
    mockTx.salesInvoiceLine.findMany.mockResolvedValue([
      {
        id: 'source-line-1',
        salesInvoiceId: 'invoice-2',
        itemId: 'item-1',
        qty: 5,
        unitPrice: 12.5,
        taxPercent: 18,
      },
    ]);

    await expect(
      service.create(
        {
          seriesId: 'series-1',
          salesInvoiceId: 'invoice-1',
          customerId: 'customer-1',
          docDate: '2026-04-21',
          lines: [{ salesInvoiceLineId: 'source-line-1', qty: 1 }],
        },
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects duplicate draft lines when their combined quantity exceeds the sold quantity', async () => {
    mockTx.documentSeries.findUnique.mockResolvedValue({
      id: 'series-1',
      prefix: 'KR',
      nextNumber: 7,
      documentType: 'SALES_RETURN',
      isActive: true,
    });
    mockTx.customer.findUnique.mockResolvedValue({ id: 'customer-1', isActive: true });
    mockTx.salesInvoice.findUnique.mockResolvedValue({
      id: 'invoice-1',
      customerId: 'customer-1',
      status: DocumentStatus.POSTED,
      warehouseId: 'warehouse-1',
      docNo: 'SH-0001',
    });
    mockTx.salesInvoiceLine.findMany.mockResolvedValue([
      {
        id: 'source-line-1',
        salesInvoiceId: 'invoice-1',
        itemId: 'item-1',
        qty: 5,
        unitPrice: 12.5,
        taxPercent: 18,
      },
    ]);
    mockTx.salesReturnLine.aggregate.mockResolvedValue({ _sum: { qty: 0 } });

    await expect(
      service.create(
        {
          seriesId: 'series-1',
          salesInvoiceId: 'invoice-1',
          customerId: 'customer-1',
          docDate: '2026-04-21',
          lines: [
            { salesInvoiceLineId: 'source-line-1', qty: 3 },
            { salesInvoiceLineId: 'source-line-1', qty: 3 },
          ],
        },
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
