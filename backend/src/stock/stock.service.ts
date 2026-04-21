import { BadRequestException, Injectable } from '@nestjs/common';
import { MovementType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { toPaginatedResponse, toPagination } from '../common/utils/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStockAdjustmentDto } from './dto/create-stock-adjustment.dto';
import { CreateStockCountDto } from './dto/create-stock-count.dto';
import { CreateStockTransferDto } from './dto/create-stock-transfer.dto';
import { StockBalanceQueryDto } from './dto/stock-balance-query.dto';
import { StockMovementQueryDto } from './dto/stock-movement-query.dto';

const COSTED_IN_MOVEMENTS = new Set<MovementType>([
  MovementType.PURCHASE_IN,
  MovementType.ADJUSTMENT_PLUS,
  MovementType.TRANSFER_IN,
  MovementType.COUNT_IN,
]);

@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async findBalances(query: StockBalanceQueryDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { skip, take } = toPagination(page, limit);
    const search = query.search?.trim();

    const where = {
      warehouseId: query.warehouseId,
      itemId: query.itemId,
      ...(search
        ? {
            OR: [
              { warehouse: { name: { contains: search, mode: 'insensitive' as const } } },
              { item: { name: { contains: search, mode: 'insensitive' as const } } },
              { item: { code: { contains: search, mode: 'insensitive' as const } } },
              { item: { barcode: { contains: search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.stockBalance.findMany({
        where,
        include: { item: true, warehouse: true },
        orderBy: this.resolveBalanceOrder(query.sortBy, query.sortOrder),
        skip,
        take,
      }),
      this.prisma.stockBalance.count({ where }),
    ]);

    return toPaginatedResponse({ items, total, page, limit });
  }

  async findMovements(query: StockMovementQueryDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { skip, take } = toPagination(page, limit);
    const search = query.search?.trim();

    const where = {
      warehouseId: query.warehouseId,
      itemId: query.itemId,
      movementType: query.movementType as MovementType | undefined,
      ...(search
        ? {
            OR: [
              { referenceNo: { contains: search, mode: 'insensitive' as const } },
              { warehouse: { name: { contains: search, mode: 'insensitive' as const } } },
              { item: { name: { contains: search, mode: 'insensitive' as const } } },
              { item: { code: { contains: search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.stockMovement.findMany({
        where,
        include: { item: true, warehouse: true },
        orderBy: this.resolveMovementOrder(query.sortBy, query.sortOrder),
        skip,
        take,
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return toPaginatedResponse({ items, total, page, limit });
  }

  async ensureSufficientStock(params: {
    warehouseId: string;
    itemId: string;
    requestedQty: number;
  }) {
    const balance = await this.prisma.stockBalance.findUnique({
      where: {
        warehouseId_itemId: {
          warehouseId: params.warehouseId,
          itemId: params.itemId,
        },
      },
    });

    const available = Number(balance?.qtyOnHand ?? 0);
    if (available < params.requestedQty) {
      throw new BadRequestException(`Insufficient stock for item ${params.itemId}`);
    }
  }

  async applyMovement(tx: PrismaService | any, params: {
    warehouseId: string;
    itemId: string;
    movementType: MovementType;
    qtyIn?: number;
    qtyOut?: number;
    unitCost?: number | null;
    purchaseInvoiceId?: string;
    salesInvoiceId?: string;
    salesReturnId?: string;
    referenceNo?: string;
    movementAt?: Date;
  }) {
    const qtyIn = Number(params.qtyIn ?? 0);
    const qtyOut = Number(params.qtyOut ?? 0);

    const current = await tx.stockBalance.findUnique({
      where: {
        warehouseId_itemId: {
          warehouseId: params.warehouseId,
          itemId: params.itemId,
        },
      },
    });

    const currentQty = Number(current?.qtyOnHand ?? 0);
    const currentAvg = Number(current?.avgCost ?? 0);
    const newQty = currentQty + qtyIn - qtyOut;

    if (newQty < 0) {
      throw new BadRequestException(`Stock cannot become negative for item ${params.itemId}`);
    }

    await tx.stockMovement.create({
      data: {
        warehouseId: params.warehouseId,
        itemId: params.itemId,
        movementType: params.movementType,
        qtyIn,
        qtyOut,
        unitCost: params.unitCost ?? null,
        purchaseInvoiceId: params.purchaseInvoiceId,
        salesInvoiceId: params.salesInvoiceId,
        salesReturnId: params.salesReturnId,
        referenceNo: params.referenceNo,
        movementAt: params.movementAt ?? new Date(),
      },
    });

    let newAvg = currentAvg;

    if (COSTED_IN_MOVEMENTS.has(params.movementType) && qtyIn > 0) {
      const incomingCost = Number(params.unitCost ?? 0);
      const totalCostBefore = currentQty * currentAvg;
      const totalCostAfter = totalCostBefore + qtyIn * incomingCost;
      newAvg = newQty > 0 ? totalCostAfter / newQty : 0;
    }

    if (!current) {
      await tx.stockBalance.create({
        data: {
          warehouseId: params.warehouseId,
          itemId: params.itemId,
          qtyOnHand: newQty,
          avgCost: newAvg,
        },
      });
      return;
    }

    await tx.stockBalance.update({
      where: {
        warehouseId_itemId: {
          warehouseId: params.warehouseId,
          itemId: params.itemId,
        },
      },
      data: {
        qtyOnHand: newQty,
        avgCost: newAvg,
      },
    });
  }

  async createAdjustment(dto: CreateStockAdjustmentDto, userId: string) {
    const operationId = randomUUID();
    const movementAt = dto.movementAt ? new Date(dto.movementAt) : new Date();
    const referenceNo = dto.referenceNo ?? `ADJ-${operationId.slice(0, 8).toUpperCase()}`;

    const result = await this.prisma.$transaction(async (tx) => {
      const balance = await tx.stockBalance.findUnique({
        where: {
          warehouseId_itemId: {
            warehouseId: dto.warehouseId,
            itemId: dto.itemId,
          },
        },
        include: {
          warehouse: true,
          item: true,
        },
      });

      const currentQty = Number(balance?.qtyOnHand ?? 0);
      const qtyChange = Number(dto.qtyChange);

      if (qtyChange < 0 && currentQty < Math.abs(qtyChange)) {
        throw new BadRequestException('Adjustment would reduce stock below zero');
      }

      await this.applyMovement(tx, {
        warehouseId: dto.warehouseId,
        itemId: dto.itemId,
        movementType:
          qtyChange > 0 ? MovementType.ADJUSTMENT_PLUS : MovementType.ADJUSTMENT_MINUS,
        qtyIn: qtyChange > 0 ? qtyChange : 0,
        qtyOut: qtyChange < 0 ? Math.abs(qtyChange) : 0,
        unitCost: dto.unitCost ?? Number(balance?.avgCost ?? 0),
        referenceNo,
        movementAt,
      });

      const updatedBalance = await tx.stockBalance.findUnique({
        where: {
          warehouseId_itemId: {
            warehouseId: dto.warehouseId,
            itemId: dto.itemId,
          },
        },
        include: {
          warehouse: true,
          item: true,
        },
      });

      return {
        operationId,
        referenceNo,
        movementType:
          qtyChange > 0 ? MovementType.ADJUSTMENT_PLUS : MovementType.ADJUSTMENT_MINUS,
        qtyChange,
        previousQty: currentQty,
        currentQty: Number(updatedBalance?.qtyOnHand ?? 0),
        warehouse: updatedBalance?.warehouse ?? balance?.warehouse ?? null,
        item: updatedBalance?.item ?? balance?.item ?? null,
      };
    });

    await this.auditLogs.log({
      userId,
      entityType: 'stock_adjustments',
      entityId: operationId,
      action: 'CREATE',
      metadata: {
        referenceNo,
        qtyChange: dto.qtyChange,
        reason: dto.reason,
        movementAt: movementAt.toISOString(),
      },
    });

    return result;
  }

  async createTransfer(dto: CreateStockTransferDto, userId: string) {
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException('Source and destination warehouses must be different');
    }

    const operationId = randomUUID();
    const movementAt = dto.movementAt ? new Date(dto.movementAt) : new Date();
    const referenceNo = dto.referenceNo ?? `TRF-${operationId.slice(0, 8).toUpperCase()}`;

    const result = await this.prisma.$transaction(async (tx) => {
      const sourceBalance = await tx.stockBalance.findUnique({
        where: {
          warehouseId_itemId: {
            warehouseId: dto.fromWarehouseId,
            itemId: dto.itemId,
          },
        },
        include: {
          warehouse: true,
          item: true,
        },
      });

      const availableQty = Number(sourceBalance?.qtyOnHand ?? 0);
      if (availableQty < Number(dto.qty)) {
        throw new BadRequestException('Transfer quantity exceeds available stock');
      }

      const unitCost = Number(sourceBalance?.avgCost ?? 0);

      await this.applyMovement(tx, {
        warehouseId: dto.fromWarehouseId,
        itemId: dto.itemId,
        movementType: MovementType.TRANSFER_OUT,
        qtyOut: Number(dto.qty),
        unitCost,
        referenceNo,
        movementAt,
      });

      await this.applyMovement(tx, {
        warehouseId: dto.toWarehouseId,
        itemId: dto.itemId,
        movementType: MovementType.TRANSFER_IN,
        qtyIn: Number(dto.qty),
        unitCost,
        referenceNo,
        movementAt,
      });

      const [fromBalance, toBalance] = await Promise.all([
        tx.stockBalance.findUnique({
          where: {
            warehouseId_itemId: {
              warehouseId: dto.fromWarehouseId,
              itemId: dto.itemId,
            },
          },
          include: { warehouse: true, item: true },
        }),
        tx.stockBalance.findUnique({
          where: {
            warehouseId_itemId: {
              warehouseId: dto.toWarehouseId,
              itemId: dto.itemId,
            },
          },
          include: { warehouse: true, item: true },
        }),
      ]);

      return {
        operationId,
        referenceNo,
        qty: Number(dto.qty),
        item: fromBalance?.item ?? toBalance?.item ?? sourceBalance?.item ?? null,
        fromWarehouse: fromBalance?.warehouse ?? sourceBalance?.warehouse ?? null,
        toWarehouse: toBalance?.warehouse ?? null,
        balances: {
          from: Number(fromBalance?.qtyOnHand ?? 0),
          to: Number(toBalance?.qtyOnHand ?? 0),
        },
      };
    });

    await this.auditLogs.log({
      userId,
      entityType: 'stock_transfers',
      entityId: operationId,
      action: 'CREATE',
      metadata: {
        referenceNo,
        qty: dto.qty,
        fromWarehouseId: dto.fromWarehouseId,
        toWarehouseId: dto.toWarehouseId,
        notes: dto.notes,
        movementAt: movementAt.toISOString(),
      },
    });

    return result;
  }

  async createCount(dto: CreateStockCountDto, userId: string) {
    const operationId = randomUUID();
    const countedAt = dto.countedAt ? new Date(dto.countedAt) : new Date();
    const referenceNo = dto.referenceNo ?? `CNT-${operationId.slice(0, 8).toUpperCase()}`;

    const result = await this.prisma.$transaction(async (tx) => {
      const balance = await tx.stockBalance.findUnique({
        where: {
          warehouseId_itemId: {
            warehouseId: dto.warehouseId,
            itemId: dto.itemId,
          },
        },
        include: {
          warehouse: true,
          item: true,
        },
      });

      const currentQty = Number(balance?.qtyOnHand ?? 0);
      const countedQty = Number(dto.countedQty);
      const difference = countedQty - currentQty;

      if (difference !== 0) {
        await this.applyMovement(tx, {
          warehouseId: dto.warehouseId,
          itemId: dto.itemId,
          movementType: difference > 0 ? MovementType.COUNT_IN : MovementType.COUNT_OUT,
          qtyIn: difference > 0 ? difference : 0,
          qtyOut: difference < 0 ? Math.abs(difference) : 0,
          unitCost: dto.unitCost ?? Number(balance?.avgCost ?? 0),
          referenceNo,
          movementAt: countedAt,
        });
      }

      const updatedBalance = await tx.stockBalance.findUnique({
        where: {
          warehouseId_itemId: {
            warehouseId: dto.warehouseId,
            itemId: dto.itemId,
          },
        },
        include: {
          warehouse: true,
          item: true,
        },
      });

      return {
        operationId,
        referenceNo,
        previousQty: currentQty,
        countedQty,
        difference,
        movementType:
          difference === 0
            ? null
            : difference > 0
              ? MovementType.COUNT_IN
              : MovementType.COUNT_OUT,
        warehouse: updatedBalance?.warehouse ?? balance?.warehouse ?? null,
        item: updatedBalance?.item ?? balance?.item ?? null,
      };
    });

    await this.auditLogs.log({
      userId,
      entityType: 'stock_counts',
      entityId: operationId,
      action: 'CREATE',
      metadata: {
        referenceNo,
        countedQty: dto.countedQty,
        difference: result.difference,
        notes: dto.notes,
        countedAt: countedAt.toISOString(),
      },
    });

    return result;
  }

  private resolveBalanceOrder(sortBy?: string, sortOrder: 'asc' | 'desc' = 'desc') {
    switch (sortBy) {
      case 'warehouse':
        return [{ warehouse: { name: sortOrder } }, { item: { name: 'asc' as const } }];
      case 'item':
        return [{ item: { name: sortOrder } }, { warehouse: { name: 'asc' as const } }];
      case 'qtyOnHand':
      case 'avgCost':
      case 'updatedAt':
        return [{ [sortBy]: sortOrder }, { warehouse: { name: 'asc' as const } }];
      default:
        return [{ updatedAt: 'desc' as const }, { warehouse: { name: 'asc' as const } }];
    }
  }

  private resolveMovementOrder(sortBy?: string, sortOrder: 'asc' | 'desc' = 'desc') {
    switch (sortBy) {
      case 'warehouse':
        return [{ warehouse: { name: sortOrder } }, { movementAt: 'desc' as const }];
      case 'item':
        return [{ item: { name: sortOrder } }, { movementAt: 'desc' as const }];
      case 'movementType':
      case 'referenceNo':
      case 'movementAt':
        return [{ [sortBy]: sortOrder }, { createdAt: 'desc' as const }];
      default:
        return [{ movementAt: 'desc' as const }, { createdAt: 'desc' as const }];
    }
  }
}
