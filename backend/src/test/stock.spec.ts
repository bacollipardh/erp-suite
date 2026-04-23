import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MovementType } from '@prisma/client';
import { AccountingService } from '../accounting/accounting.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { FinancialPeriodsService } from '../financial-periods/financial-periods.service';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../stock/stock.service';

const mockBalance = {
  warehouseId: 'wh-1',
  itemId: 'item-1',
  qtyOnHand: 10,
  avgCost: 100,
};

const mockPrisma = {
  $transaction: jest.fn(),
  stockBalance: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  stockMovement: {
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
  },
};

const mockAuditLogs = {
  log: jest.fn(),
};

const mockFinancialPeriods = {
  assertDateOpen: jest.fn(),
};

const mockAccountingService = {
  postInventoryAdjustmentTx: jest.fn(),
};

describe('StockService', () => {
  let service: StockService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditLogsService, useValue: mockAuditLogs },
        { provide: FinancialPeriodsService, useValue: mockFinancialPeriods },
        { provide: AccountingService, useValue: mockAccountingService },
      ],
    }).compile();

    service = module.get<StockService>(StockService);
    jest.clearAllMocks();
  });

  describe('ensureSufficientStock', () => {
    it('passes when stock is sufficient', async () => {
      mockPrisma.stockBalance.findUnique.mockResolvedValueOnce(mockBalance);
      await expect(
        service.ensureSufficientStock({ warehouseId: 'wh-1', itemId: 'item-1', requestedQty: 5 }),
      ).resolves.not.toThrow();
    });

    it('throws when stock is insufficient', async () => {
      mockPrisma.stockBalance.findUnique.mockResolvedValueOnce({ ...mockBalance, qtyOnHand: 3 });
      await expect(
        service.ensureSufficientStock({ warehouseId: 'wh-1', itemId: 'item-1', requestedQty: 5 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when no balance exists', async () => {
      mockPrisma.stockBalance.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.ensureSufficientStock({ warehouseId: 'wh-1', itemId: 'item-1', requestedQty: 1 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findBalances', () => {
    it('returns summary metadata for filtered balances', async () => {
      mockPrisma.$transaction.mockResolvedValueOnce([
        [
          {
            id: 'bal-1',
            qtyOnHand: 5,
            avgCost: 10,
            updatedAt: new Date('2026-04-22T10:00:00.000Z'),
            warehouse: { id: 'wh-1', name: 'Main Warehouse' },
            item: {
              id: 'item-1',
              name: 'Laptop',
              category: { id: 'cat-1', name: 'Goods' },
              unit: { id: 'unit-1', name: 'Cope' },
            },
          },
        ],
        2,
        [
          {
            qtyOnHand: 5,
            avgCost: 10,
            warehouseId: 'wh-1',
            itemId: 'item-1',
            item: { category: { id: 'cat-1', name: 'Goods' } },
          },
          {
            qtyOnHand: 3,
            avgCost: 12,
            warehouseId: 'wh-1',
            itemId: 'item-2',
            item: { category: { id: 'cat-1', name: 'Goods' } },
          },
        ],
      ]);

      const result = await service.findBalances({
        categoryId: 'cat-1',
        page: 1,
        limit: 20,
      });

      expect(result.summary.totalQty).toBe(8);
      expect(result.summary.totalValue).toBe(86);
      expect(result.summary.warehouseCount).toBe(1);
      expect(result.summary.itemCount).toBe(2);
      expect(result.summary.categoryCount).toBe(1);
      expect(result.summary.topCategories[0]).toEqual(
        expect.objectContaining({
          totalQty: 8,
          totalValue: 86,
          itemCount: 2,
        }),
      );
    });
  });

  describe('findMovements', () => {
    it('returns movement summary and breakdown for filtered scope', async () => {
      const lastMovementAt = new Date('2026-04-21T09:30:00.000Z');

      mockPrisma.$transaction.mockResolvedValueOnce([
        [
          {
            id: 'mov-1',
            movementType: MovementType.PURCHASE_IN,
            qtyIn: 10,
            qtyOut: 0,
            movementAt: lastMovementAt,
            warehouse: { id: 'wh-1', name: 'Main Warehouse' },
            item: {
              id: 'item-1',
              name: 'Laptop',
              category: { id: 'cat-1', name: 'Goods' },
            },
          },
        ],
        2,
        [
          {
            movementType: MovementType.PURCHASE_IN,
            qtyIn: 10,
            qtyOut: 0,
            referenceNo: 'FB-000001',
            movementAt: new Date('2026-04-20T08:00:00.000Z'),
            warehouseId: 'wh-1',
            itemId: 'item-1',
            item: { category: { id: 'cat-1', name: 'Goods' } },
          },
          {
            movementType: MovementType.SALE_OUT,
            qtyIn: 0,
            qtyOut: 4,
            referenceNo: 'FS-000001',
            movementAt: lastMovementAt,
            warehouseId: 'wh-1',
            itemId: 'item-1',
            item: { category: { id: 'cat-1', name: 'Goods' } },
          },
        ],
      ]);

      const result = await service.findMovements({
        categoryId: 'cat-1',
        dateFrom: '2026-04-01',
        dateTo: '2026-04-30',
        page: 1,
        limit: 20,
      });

      expect(result.summary.totalIn).toBe(10);
      expect(result.summary.totalOut).toBe(4);
      expect(result.summary.netQty).toBe(6);
      expect(result.summary.referenceCount).toBe(2);
      expect(result.summary.categoryCount).toBe(1);
      expect(result.summary.latestMovementAt).toEqual(lastMovementAt);
      expect(result.summary.byType).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            movementType: MovementType.PURCHASE_IN,
            totalIn: 10,
            totalOut: 0,
          }),
          expect.objectContaining({
            movementType: MovementType.SALE_OUT,
            totalIn: 0,
            totalOut: 4,
          }),
        ]),
      );
    });
  });

  describe('applyMovement - PURCHASE_IN updates avgCost', () => {
    it('creates balance with correct avgCost when none exists', async () => {
      mockPrisma.stockBalance.findUnique.mockResolvedValueOnce(null);
      mockPrisma.stockMovement.create.mockResolvedValueOnce({});
      mockPrisma.stockBalance.create.mockResolvedValueOnce({});

      await service.applyMovement(mockPrisma as any, {
        warehouseId: 'wh-1',
        itemId: 'item-1',
        movementType: MovementType.PURCHASE_IN,
        qtyIn: 10,
        unitCost: 50,
        movementAt: new Date(),
      });

      expect(mockPrisma.stockBalance.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ qtyOnHand: 10, avgCost: 50 }) }),
      );
    });

    it('throws before creating a movement when stock would go negative', async () => {
      mockPrisma.stockBalance.findUnique.mockResolvedValueOnce({ ...mockBalance, qtyOnHand: 2 });

      await expect(
        service.applyMovement(mockPrisma as any, {
          warehouseId: 'wh-1',
          itemId: 'item-1',
          movementType: MovementType.SALE_OUT,
          qtyOut: 5,
          movementAt: new Date(),
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.stockMovement.create).not.toHaveBeenCalled();
    });
  });

  describe('stock operations', () => {
    it('rejects transfer when source and destination warehouses are the same', async () => {
      await expect(
        service.createTransfer(
          {
            fromWarehouseId: 'wh-1',
            toWarehouseId: 'wh-1',
            itemId: 'item-1',
            qty: 1,
          },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
