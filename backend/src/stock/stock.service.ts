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

type StockBalanceSummaryRow = {
  qtyOnHand: number | { toString(): string };
  avgCost: number | { toString(): string };
  warehouseId: string;
  itemId: string;
  item: {
    category: {
      id: string;
      name: string;
    } | null;
  };
};

type StockMovementSummaryRow = {
  movementType: MovementType;
  qtyIn: number | { toString(): string };
  qtyOut: number | { toString(): string };
  referenceNo: string | null;
  movementAt: Date;
  warehouseId: string;
  itemId: string;
  item: {
    category: {
      id: string;
      name: string;
    } | null;
  };
};

function roundQty(value: number) {
  return Math.round(value * 1000) / 1000;
}

function startOfDay(value: string) {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfDay(value: string) {
  const date = new Date(value);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999),
  );
}

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
    const where = this.buildBalanceWhere(query);

    const [items, total, summaryRows] = await this.prisma.$transaction([
      this.prisma.stockBalance.findMany({
        where,
        include: {
          warehouse: true,
          item: {
            include: {
              category: true,
              unit: true,
            },
          },
        },
        orderBy: this.resolveBalanceOrder(query.sortBy, query.sortOrder),
        skip,
        take,
      }),
      this.prisma.stockBalance.count({ where }),
      this.prisma.stockBalance.findMany({
        where,
        select: {
          qtyOnHand: true,
          avgCost: true,
          warehouseId: true,
          itemId: true,
          item: {
            select: {
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      ...toPaginatedResponse({ items, total, page, limit }),
      summary: this.buildBalanceSummary(summaryRows as StockBalanceSummaryRow[]),
      appliedFilters: {
        search: query.search ?? '',
        warehouseId: query.warehouseId ?? null,
        categoryId: query.categoryId ?? null,
        itemId: query.itemId ?? null,
        sortBy: query.sortBy ?? 'updatedAt',
        sortOrder: query.sortOrder ?? 'desc',
      },
    };
  }

  async findMovements(query: StockMovementQueryDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { skip, take } = toPagination(page, limit);
    const where = this.buildMovementWhere(query);

    const [items, total, summaryRows] = await this.prisma.$transaction([
      this.prisma.stockMovement.findMany({
        where,
        include: {
          warehouse: true,
          item: {
            include: {
              category: true,
              unit: true,
            },
          },
          purchaseInvoice: {
            select: {
              id: true,
              docNo: true,
            },
          },
          salesInvoice: {
            select: {
              id: true,
              docNo: true,
            },
          },
          salesReturn: {
            select: {
              id: true,
              docNo: true,
            },
          },
        },
        orderBy: this.resolveMovementOrder(query.sortBy, query.sortOrder),
        skip,
        take,
      }),
      this.prisma.stockMovement.count({ where }),
      this.prisma.stockMovement.findMany({
        where,
        select: {
          movementType: true,
          qtyIn: true,
          qtyOut: true,
          referenceNo: true,
          movementAt: true,
          warehouseId: true,
          itemId: true,
          item: {
            select: {
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      ...toPaginatedResponse({ items, total, page, limit }),
      summary: this.buildMovementSummary(summaryRows as StockMovementSummaryRow[]),
      appliedFilters: {
        search: query.search ?? '',
        warehouseId: query.warehouseId ?? null,
        categoryId: query.categoryId ?? null,
        itemId: query.itemId ?? null,
        movementType: query.movementType ?? null,
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null,
        sortBy: query.sortBy ?? 'movementAt',
        sortOrder: query.sortOrder ?? 'desc',
      },
    };
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

  async applyMovement(
    tx: PrismaService | any,
    params: {
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
    },
  ) {
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

  private buildBalanceWhere(query: StockBalanceQueryDto) {
    const search = query.search?.trim();

    return {
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.itemId ? { itemId: query.itemId } : {}),
      ...(query.categoryId
        ? {
            item: {
              categoryId: query.categoryId,
            },
          }
        : {}),
      ...(search
        ? {
            AND: [
              {
                OR: [
                  { warehouse: { name: { contains: search, mode: 'insensitive' as const } } },
                  { item: { name: { contains: search, mode: 'insensitive' as const } } },
                  { item: { code: { contains: search, mode: 'insensitive' as const } } },
                  { item: { barcode: { contains: search, mode: 'insensitive' as const } } },
                  {
                    item: {
                      category: {
                        name: { contains: search, mode: 'insensitive' as const },
                      },
                    },
                  },
                ],
              },
            ],
          }
        : {}),
    };
  }

  private buildMovementWhere(query: StockMovementQueryDto) {
    const search = query.search?.trim();

    return {
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.itemId ? { itemId: query.itemId } : {}),
      ...(query.categoryId
        ? {
            item: {
              categoryId: query.categoryId,
            },
          }
        : {}),
      ...(query.movementType ? { movementType: query.movementType as MovementType } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            movementAt: {
              ...(query.dateFrom ? { gte: startOfDay(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: endOfDay(query.dateTo) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            AND: [
              {
                OR: [
                  { referenceNo: { contains: search, mode: 'insensitive' as const } },
                  { warehouse: { name: { contains: search, mode: 'insensitive' as const } } },
                  { item: { name: { contains: search, mode: 'insensitive' as const } } },
                  { item: { code: { contains: search, mode: 'insensitive' as const } } },
                  {
                    item: {
                      category: {
                        name: { contains: search, mode: 'insensitive' as const },
                      },
                    },
                  },
                  {
                    purchaseInvoice: {
                      docNo: { contains: search, mode: 'insensitive' as const },
                    },
                  },
                  {
                    salesInvoice: {
                      docNo: { contains: search, mode: 'insensitive' as const },
                    },
                  },
                  {
                    salesReturn: {
                      docNo: { contains: search, mode: 'insensitive' as const },
                    },
                  },
                ],
              },
            ],
          }
        : {}),
    };
  }

  private buildBalanceSummary(rows: StockBalanceSummaryRow[]) {
    let totalQty = 0;
    let totalValue = 0;
    const warehouseIds = new Set<string>();
    const itemIds = new Set<string>();
    const categoryMap = new Map<
      string,
      {
        category: { id: string; name: string } | null;
        totalQty: number;
        totalValue: number;
        itemIds: Set<string>;
      }
    >();

    for (const row of rows) {
      const qtyOnHand = Number(row.qtyOnHand ?? 0);
      const avgCost = Number(row.avgCost ?? 0);
      const stockValue = qtyOnHand * avgCost;
      const categoryKey = row.item.category?.id ?? 'uncategorized';
      const existing = categoryMap.get(categoryKey) ?? {
        category: row.item.category ?? null,
        totalQty: 0,
        totalValue: 0,
        itemIds: new Set<string>(),
      };

      totalQty += qtyOnHand;
      totalValue += stockValue;
      warehouseIds.add(row.warehouseId);
      itemIds.add(row.itemId);
      existing.totalQty += qtyOnHand;
      existing.totalValue += stockValue;
      existing.itemIds.add(row.itemId);
      categoryMap.set(categoryKey, existing);
    }

    return {
      rowCount: rows.length,
      totalQty: roundQty(totalQty),
      totalValue: Number(totalValue.toFixed(2)),
      warehouseCount: warehouseIds.size,
      itemCount: itemIds.size,
      categoryCount: categoryMap.size,
      topCategories: Array.from(categoryMap.values())
        .map((row) => ({
          category: row.category,
          totalQty: roundQty(row.totalQty),
          totalValue: Number(row.totalValue.toFixed(2)),
          itemCount: row.itemIds.size,
        }))
        .sort((left, right) => right.totalValue - left.totalValue)
        .slice(0, 8),
    };
  }

  private buildMovementSummary(rows: StockMovementSummaryRow[]) {
    let totalIn = 0;
    let totalOut = 0;
    let latestMovementAt: Date | null = null;
    const warehouseIds = new Set<string>();
    const itemIds = new Set<string>();
    const categoryIds = new Set<string>();
    const referenceNos = new Set<string>();
    const movementMap = new Map<
      MovementType,
      {
        movementType: MovementType;
        count: number;
        totalIn: number;
        totalOut: number;
      }
    >();

    for (const row of rows) {
      const qtyIn = Number(row.qtyIn ?? 0);
      const qtyOut = Number(row.qtyOut ?? 0);
      const existing = movementMap.get(row.movementType) ?? {
        movementType: row.movementType,
        count: 0,
        totalIn: 0,
        totalOut: 0,
      };

      totalIn += qtyIn;
      totalOut += qtyOut;
      warehouseIds.add(row.warehouseId);
      itemIds.add(row.itemId);
      if (row.item.category?.id) {
        categoryIds.add(row.item.category.id);
      }
      if (row.referenceNo) {
        referenceNos.add(row.referenceNo);
      }
      if (!latestMovementAt || row.movementAt > latestMovementAt) {
        latestMovementAt = row.movementAt;
      }

      existing.count += 1;
      existing.totalIn += qtyIn;
      existing.totalOut += qtyOut;
      movementMap.set(row.movementType, existing);
    }

    return {
      movementCount: rows.length,
      totalIn: roundQty(totalIn),
      totalOut: roundQty(totalOut),
      netQty: roundQty(totalIn - totalOut),
      referenceCount: referenceNos.size,
      warehouseCount: warehouseIds.size,
      itemCount: itemIds.size,
      categoryCount: categoryIds.size,
      latestMovementAt,
      byType: Array.from(movementMap.values())
        .map((row) => ({
          movementType: row.movementType,
          count: row.count,
          totalIn: roundQty(row.totalIn),
          totalOut: roundQty(row.totalOut),
          netQty: roundQty(row.totalIn - row.totalOut),
        }))
        .sort((left, right) => right.count - left.count),
    };
  }

  private resolveBalanceOrder(sortBy?: string, sortOrder: 'asc' | 'desc' = 'desc') {
    switch (sortBy) {
      case 'warehouse':
        return [{ warehouse: { name: sortOrder } }, { item: { name: 'asc' as const } }];
      case 'category':
        return [
          { item: { category: { name: sortOrder } } },
          { item: { name: 'asc' as const } },
          { warehouse: { name: 'asc' as const } },
        ];
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
      case 'category':
        return [
          { item: { category: { name: sortOrder } } },
          { item: { name: 'asc' as const } },
          { movementAt: 'desc' as const },
        ];
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
