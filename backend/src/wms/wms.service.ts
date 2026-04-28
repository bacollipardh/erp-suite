import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DocumentStatus,
  WmsInventoryStatus,
  WmsLocationStatus,
  WmsLocationType,
  WmsMovementType,
  WmsReservationStatus,
  WmsTaskStatus,
  WmsTaskType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toPaginatedResponse, toPagination } from '../common/utils/pagination';
import { WmsQueryDto } from './dto/wms-query.dto';
import { CreateWmsLocationDto, UpdateWmsLocationDto } from './dto/wms-location.dto';
import {
  WmsCountDto,
  WmsCycleCountPlanDto,
  WmsMoveDto,
  WmsPutawayDto,
  WmsReceiveDto,
  WmsReplenishDto,
  WmsStatusDto,
  WmsTaskActionDto,
} from './dto/wms-operations.dto';

type Tx = PrismaService | any;

type SalesInvoiceForWms = {
  id: string;
  docNo: string;
  warehouseId: string;
  status: DocumentStatus;
  lines: Array<{
    id: string;
    itemId: string;
    qty: number | string | { toString(): string };
  }>;
};

function numberValue(value: number | string | { toString(): string } | null | undefined) {
  return Number(value ?? 0);
}

function roundQty(value: number) {
  return Math.round(value * 1000) / 1000;
}

function dateOnly(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function nullableText(value?: string | null) {
  const clean = value?.trim();
  return clean ? clean : null;
}

function todayUtcDate() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

@Injectable()
export class WmsService {
  constructor(private readonly prisma: PrismaService) {}

  async findLocations(query: WmsQueryDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { skip, take } = toPagination(page, limit);
    const search = query.search?.trim();
    const where = {
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.status ? { status: query.status as WmsLocationStatus } : {}),
      ...(query.locationType ? { locationType: query.locationType as WmsLocationType } : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: 'insensitive' as const } },
              { barcode: { contains: search, mode: 'insensitive' as const } },
              { zone: { contains: search, mode: 'insensitive' as const } },
              { aisle: { contains: search, mode: 'insensitive' as const } },
              { rack: { contains: search, mode: 'insensitive' as const } },
              { shelf: { contains: search, mode: 'insensitive' as const } },
              { bin: { contains: search, mode: 'insensitive' as const } },
              { warehouse: { name: { contains: search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.wmsLocation.findMany({
        where,
        include: { warehouse: true },
        orderBy: [{ warehouse: { name: 'asc' } }, { code: 'asc' }],
        skip,
        take,
      }),
      this.prisma.wmsLocation.count({ where }),
    ]);

    return toPaginatedResponse({ items, total, page, limit });
  }

  async createLocation(dto: CreateWmsLocationDto) {
    await this.ensureWarehouse(dto.warehouseId);
    const locationType = this.resolveLocationType(dto.locationType, WmsLocationType.STORAGE);
    const status = this.resolveLocationStatus(dto.status, WmsLocationStatus.ACTIVE);

    return this.prisma.wmsLocation.create({
      data: {
        warehouseId: dto.warehouseId,
        code: dto.code.trim(),
        barcode: nullableText(dto.barcode),
        zone: dto.zone.trim(),
        aisle: nullableText(dto.aisle),
        rack: nullableText(dto.rack),
        shelf: nullableText(dto.shelf),
        bin: nullableText(dto.bin),
        locationType,
        status,
        maxWeight: dto.maxWeight,
        maxVolume: dto.maxVolume,
        maxQty: dto.maxQty,
        notes: nullableText(dto.notes),
      },
      include: { warehouse: true },
    });
  }

  async updateLocation(id: string, dto: UpdateWmsLocationDto) {
    const existing = await this.prisma.wmsLocation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('WMS location not found');

    return this.prisma.wmsLocation.update({
      where: { id },
      data: {
        code: dto.code?.trim(),
        barcode: dto.barcode === undefined ? undefined : nullableText(dto.barcode),
        zone: dto.zone?.trim(),
        aisle: dto.aisle === undefined ? undefined : nullableText(dto.aisle),
        rack: dto.rack === undefined ? undefined : nullableText(dto.rack),
        shelf: dto.shelf === undefined ? undefined : nullableText(dto.shelf),
        bin: dto.bin === undefined ? undefined : nullableText(dto.bin),
        locationType:
          dto.locationType === undefined
            ? undefined
            : this.resolveLocationType(dto.locationType, existing.locationType),
        status:
          dto.status === undefined
            ? undefined
            : this.resolveLocationStatus(dto.status, existing.status),
        maxWeight: dto.maxWeight,
        maxVolume: dto.maxVolume,
        maxQty: dto.maxQty,
        notes: dto.notes === undefined ? undefined : nullableText(dto.notes),
      },
      include: { warehouse: true },
    });
  }

  async findBalances(query: WmsQueryDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { skip, take } = toPagination(page, limit);
    const search = query.search?.trim();
    const where = {
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.locationId ? { locationId: query.locationId } : {}),
      ...(query.itemId ? { itemId: query.itemId } : {}),
      ...(query.status ? { inventoryStatus: query.status as WmsInventoryStatus } : {}),
      ...(query.lotCode ? { lotCode: query.lotCode } : {}),
      ...(query.serialNo ? { serialNo: query.serialNo } : {}),
      ...(search
        ? {
            OR: [
              { lotCode: { contains: search, mode: 'insensitive' as const } },
              { serialNo: { contains: search, mode: 'insensitive' as const } },
              { item: { name: { contains: search, mode: 'insensitive' as const } } },
              { item: { code: { contains: search, mode: 'insensitive' as const } } },
              { item: { barcode: { contains: search, mode: 'insensitive' as const } } },
              { location: { code: { contains: search, mode: 'insensitive' as const } } },
              { location: { barcode: { contains: search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [items, total, summaryRows] = await this.prisma.$transaction([
      this.prisma.wmsStock.findMany({
        where,
        include: {
          warehouse: true,
          location: true,
          item: { include: { category: true, unit: true } },
        },
        orderBy: [
          { expiryDate: 'asc' },
          { location: { code: 'asc' } },
          { item: { name: 'asc' } },
        ],
        skip,
        take,
      }),
      this.prisma.wmsStock.count({ where }),
      this.prisma.wmsStock.findMany({
        where,
        select: {
          qtyOnHand: true,
          reservedQty: true,
          pickedQty: true,
          inventoryStatus: true,
          itemId: true,
          locationId: true,
          warehouseId: true,
        },
      }),
    ]);

    return {
      ...toPaginatedResponse({ items, total, page, limit }),
      summary: this.buildBalanceSummary(summaryRows),
    };
  }

  async findMovements(query: WmsQueryDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { skip, take } = toPagination(page, limit);
    const search = query.search?.trim();
    const where = {
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.itemId ? { itemId: query.itemId } : {}),
      ...(query.locationId
        ? {
            OR: [{ fromLocationId: query.locationId }, { toLocationId: query.locationId }],
          }
        : {}),
      ...(search
        ? {
            OR: [
              { referenceNo: { contains: search, mode: 'insensitive' as const } },
              { lotCode: { contains: search, mode: 'insensitive' as const } },
              { serialNo: { contains: search, mode: 'insensitive' as const } },
              { item: { name: { contains: search, mode: 'insensitive' as const } } },
              { item: { code: { contains: search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.wmsMovement.findMany({
        where,
        include: {
          warehouse: true,
          item: true,
          fromLocation: true,
          toLocation: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.wmsMovement.count({ where }),
    ]);

    return toPaginatedResponse({ items, total, page, limit });
  }

  async findTasks(query: WmsQueryDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { skip, take } = toPagination(page, limit);
    const search = query.search?.trim();
    const where = {
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.itemId ? { itemId: query.itemId } : {}),
      ...(query.status ? { status: query.status as WmsTaskStatus } : {}),
      ...(search
        ? {
            OR: [
              { referenceNo: { contains: search, mode: 'insensitive' as const } },
              { lotCode: { contains: search, mode: 'insensitive' as const } },
              { serialNo: { contains: search, mode: 'insensitive' as const } },
              { item: { name: { contains: search, mode: 'insensitive' as const } } },
              { item: { code: { contains: search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.wmsTask.findMany({
        where,
        include: {
          warehouse: true,
          item: true,
          sourceLocation: true,
          destinationLocation: true,
        },
        orderBy: [{ status: 'asc' }, { priority: 'asc' }, { createdAt: 'desc' }],
        skip,
        take,
      }),
      this.prisma.wmsTask.count({ where }),
    ]);

    return toPaginatedResponse({ items, total, page, limit });
  }

  async findReservations(query: WmsQueryDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { skip, take } = toPagination(page, limit);
    const search = query.search?.trim();
    const where = {
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.locationId ? { locationId: query.locationId } : {}),
      ...(query.itemId ? { itemId: query.itemId } : {}),
      ...(query.status ? { status: query.status as WmsReservationStatus } : {}),
      ...(query.sourceId ? { salesInvoiceId: query.sourceId } : {}),
      ...(search
        ? {
            OR: [
              { lotCode: { contains: search, mode: 'insensitive' as const } },
              { serialNo: { contains: search, mode: 'insensitive' as const } },
              { item: { name: { contains: search, mode: 'insensitive' as const } } },
              { item: { code: { contains: search, mode: 'insensitive' as const } } },
              { location: { code: { contains: search, mode: 'insensitive' as const } } },
              { salesInvoice: { docNo: { contains: search, mode: 'insensitive' as const } } },
              { salesInvoice: { customer: { name: { contains: search, mode: 'insensitive' as const } } } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.wmsReservation.findMany({
        where,
        include: {
          warehouse: true,
          location: true,
          item: true,
          salesInvoice: { include: { customer: true } },
          salesInvoiceLine: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.wmsReservation.count({ where }),
    ]);

    return toPaginatedResponse({ items, total, page, limit });
  }

  async findExpiry(query: WmsQueryDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const days = query.days ?? 30;
    const { skip, take } = toPagination(page, limit);
    const cutoff = todayUtcDate();
    cutoff.setUTCDate(cutoff.getUTCDate() + days);
    const where = {
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.locationId ? { locationId: query.locationId } : {}),
      ...(query.itemId ? { itemId: query.itemId } : {}),
      expiryDate: { not: null, lte: cutoff },
      ...(query.status ? { inventoryStatus: query.status as WmsInventoryStatus } : {}),
    };

    const [items, total, summaryRows] = await this.prisma.$transaction([
      this.prisma.wmsStock.findMany({
        where,
        include: { warehouse: true, location: true, item: true },
        orderBy: [{ expiryDate: 'asc' }, { item: { name: 'asc' } }],
        skip,
        take,
      }),
      this.prisma.wmsStock.count({ where }),
      this.prisma.wmsStock.findMany({
        where,
        select: { qtyOnHand: true, reservedQty: true, pickedQty: true, inventoryStatus: true },
      }),
    ]);

    return {
      ...toPaginatedResponse({ items, total, page, limit }),
      summary: {
        rows: summaryRows.length,
        qtyOnHand: roundQty(summaryRows.reduce((sum, row) => sum + numberValue(row.qtyOnHand), 0)),
        reservedQty: roundQty(summaryRows.reduce((sum, row) => sum + numberValue(row.reservedQty), 0)),
        pickedQty: roundQty(summaryRows.reduce((sum, row) => sum + numberValue(row.pickedQty), 0)),
        days,
      },
    };
  }

  async receive(dto: WmsReceiveDto, userId: string) {
    const qty = Number(dto.qty);
    const serialNumbers = (dto.serialNumbers ?? []).map((entry) => entry.trim()).filter(Boolean);
    if (!serialNumbers.length && (!Number.isFinite(qty) || qty <= 0)) {
      throw new BadRequestException('Quantity must be greater than zero');
    }

    const location = await this.getActiveLocation(dto.locationId);
    await this.ensureItem(dto.itemId);

    const inventoryStatus = this.resolveInventoryStatus(
      dto.inventoryStatus,
      location.locationType === WmsLocationType.QUARANTINE
        ? WmsInventoryStatus.QUARANTINE
        : WmsInventoryStatus.AVAILABLE,
    );
    const expiryDate = dateOnly(dto.expiryDate);
    const manufacturingDate = dateOnly(dto.manufacturingDate);
    const lotCode = nullableText(dto.lotCode);
    const referenceNo = nullableText(dto.referenceNo) ?? `RCV-${Date.now()}`;

    return this.prisma.$transaction(async (tx) => {
      const rows = serialNumbers.length
        ? serialNumbers.map((serialNo) => ({ qty: 1, serialNo }))
        : [{ qty, serialNo: null }];

      const results = [];
      for (const row of rows) {
        const stock = await this.increaseStock(tx, {
          warehouseId: location.warehouseId,
          locationId: location.id,
          itemId: dto.itemId,
          qty: row.qty,
          lotCode,
          serialNo: row.serialNo,
          expiryDate,
          manufacturingDate,
          inventoryStatus,
        });

        await this.createMovement(tx, {
          warehouseId: location.warehouseId,
          itemId: dto.itemId,
          toLocationId: location.id,
          movementType: WmsMovementType.RECEIVE,
          qty: row.qty,
          lotCode,
          serialNo: row.serialNo,
          expiryDate,
          sourceType: nullableText(dto.sourceType),
          sourceId: nullableText(dto.sourceId),
          referenceNo,
          notes: nullableText(dto.notes),
          createdById: userId,
        });
        results.push(stock);
      }

      await tx.wmsTask.create({
        data: {
          warehouseId: location.warehouseId,
          itemId: dto.itemId,
          destinationLocationId: location.id,
          taskType: WmsTaskType.RECEIVE,
          status: WmsTaskStatus.DONE,
          qty: serialNumbers.length ? serialNumbers.length : qty,
          lotCode,
          expiryDate,
          sourceType: nullableText(dto.sourceType),
          sourceId: nullableText(dto.sourceId),
          referenceNo,
          notes: nullableText(dto.notes),
          createdById: userId,
          completedAt: new Date(),
        },
      });

      return { referenceNo, items: results };
    });
  }

  async move(dto: WmsMoveDto, userId: string) {
    return this.executeStockMove(dto, userId, {
      movementType: WmsMovementType.MOVE,
      taskType: WmsTaskType.MOVE,
      referencePrefix: 'MOVE',
    });
  }

  async putaway(dto: WmsPutawayDto, userId: string) {
    return this.executeStockMove(dto, userId, {
      movementType: WmsMovementType.PUTAWAY,
      taskType: WmsTaskType.PUTAWAY,
      referencePrefix: 'PUT',
      sourceLocationTypes: [WmsLocationType.RECEIVING, WmsLocationType.RETURNS, WmsLocationType.QUARANTINE],
      destinationLocationTypes: [WmsLocationType.STORAGE, WmsLocationType.PICKING, WmsLocationType.QUARANTINE],
    });
  }

  async replenish(dto: WmsReplenishDto, userId: string) {
    return this.executeStockMove(dto, userId, {
      movementType: WmsMovementType.REPLENISH,
      taskType: WmsTaskType.REPLENISH,
      referencePrefix: 'REP',
      sourceLocationTypes: [WmsLocationType.STORAGE],
      destinationLocationTypes: [WmsLocationType.PICKING],
    });
  }

  async count(dto: WmsCountDto, userId: string) {
    const countedQty = Number(dto.countedQty);
    if (!Number.isFinite(countedQty) || countedQty < 0) {
      throw new BadRequestException('Counted quantity is required');
    }

    const location = await this.getActiveLocation(dto.locationId);
    const lotCode = nullableText(dto.lotCode);
    const serialNo = nullableText(dto.serialNo);
    const expiryDate = dateOnly(dto.expiryDate);
    const referenceNo = nullableText(dto.referenceNo) ?? `COUNT-${Date.now()}`;

    return this.prisma.$transaction(async (tx) => {
      const stock = await this.findStock(tx, {
        locationId: dto.locationId,
        itemId: dto.itemId,
        lotCode,
        serialNo,
        expiryDate,
        inventoryStatus: WmsInventoryStatus.AVAILABLE,
      });
      const currentQty = numberValue(stock?.qtyOnHand);
      const reservedPicked = numberValue(stock?.reservedQty) + numberValue(stock?.pickedQty);
      if (countedQty < reservedPicked) {
        throw new BadRequestException('Counted quantity cannot be lower than reserved or picked stock');
      }

      if (stock) {
        await tx.wmsStock.update({ where: { id: stock.id }, data: { qtyOnHand: countedQty } });
      } else if (countedQty > 0) {
        await this.increaseStock(tx, {
          warehouseId: location.warehouseId,
          locationId: location.id,
          itemId: dto.itemId,
          qty: countedQty,
          lotCode,
          serialNo,
          expiryDate,
          manufacturingDate: null,
          inventoryStatus: WmsInventoryStatus.AVAILABLE,
        });
      }

      await this.createMovement(tx, {
        warehouseId: location.warehouseId,
        itemId: dto.itemId,
        fromLocationId: currentQty > countedQty ? location.id : undefined,
        toLocationId: countedQty > currentQty ? location.id : undefined,
        movementType: WmsMovementType.COUNT_ADJUSTMENT,
        qty: Math.abs(countedQty - currentQty),
        lotCode,
        serialNo,
        expiryDate,
        referenceNo,
        notes: nullableText(dto.notes),
        createdById: userId,
      });

      await tx.wmsTask.create({
        data: {
          warehouseId: location.warehouseId,
          itemId: dto.itemId,
          sourceLocationId: location.id,
          taskType: WmsTaskType.COUNT,
          status: WmsTaskStatus.DONE,
          qty: countedQty,
          lotCode,
          serialNo,
          expiryDate,
          referenceNo,
          notes: nullableText(dto.notes),
          createdById: userId,
          completedAt: new Date(),
        },
      });

      return { referenceNo, previousQty: currentQty, countedQty, difference: roundQty(countedQty - currentQty) };
    });
  }

  async changeInventoryStatus(dto: WmsStatusDto, userId: string) {
    const location = await this.getActiveLocation(dto.locationId);
    const status = this.resolveInventoryStatus(dto.inventoryStatus, WmsInventoryStatus.AVAILABLE);
    const lotCode = nullableText(dto.lotCode);
    const serialNo = nullableText(dto.serialNo);
    const expiryDate = dateOnly(dto.expiryDate);
    const stock = await this.findStock(this.prisma, {
      locationId: dto.locationId,
      itemId: dto.itemId,
      lotCode,
      serialNo,
      expiryDate,
    });
    if (!stock) throw new NotFoundException('WMS stock not found');
    if (numberValue(stock.reservedQty) > 0 || numberValue(stock.pickedQty) > 0) {
      throw new BadRequestException('Reserved or picked stock cannot change QC status');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.wmsStock.update({
        where: { id: stock.id },
        data: { inventoryStatus: status },
      });
      await this.createMovement(tx, {
        warehouseId: location.warehouseId,
        itemId: dto.itemId,
        fromLocationId: location.id,
        toLocationId: location.id,
        movementType:
          status === WmsInventoryStatus.QUARANTINE
            ? WmsMovementType.QUARANTINE
            : status === WmsInventoryStatus.DAMAGED
              ? WmsMovementType.DAMAGE
              : WmsMovementType.RELEASE_QUARANTINE,
        qty: numberValue(stock.qtyOnHand),
        lotCode,
        serialNo,
        expiryDate,
        notes: nullableText(dto.notes),
        createdById: userId,
      });
      return updated;
    });
  }

  async planSalesPick(salesInvoiceId: string, userId: string) {
    const invoice = await this.loadSalesInvoiceForWms(salesInvoiceId);
    if (invoice.status !== DocumentStatus.DRAFT) {
      throw new BadRequestException('Picking can be planned only for draft sales invoices');
    }

    const existing = await this.prisma.wmsReservation.count({
      where: {
        salesInvoiceId,
        status: { in: [WmsReservationStatus.RESERVED, WmsReservationStatus.PICKED] },
      },
    });
    if (existing > 0) {
      throw new BadRequestException('This invoice already has active WMS reservations');
    }

    return this.prisma.$transaction(async (tx) => {
      const created = [];
      for (const line of invoice.lines) {
        const qtyNeeded = numberValue(line.qty);
        const allocations = await this.allocateAvailableStock(tx, {
          warehouseId: invoice.warehouseId,
          itemId: line.itemId,
          qtyNeeded,
        });

        const allocatedTotal = roundQty(allocations.reduce((sum, row) => sum + row.qty, 0));
        if (allocatedTotal < qtyNeeded) {
          throw new BadRequestException(`WMS stock is not available for item ${line.itemId}`);
        }

        for (const allocation of allocations) {
          await tx.wmsStock.update({
            where: { id: allocation.stock.id },
            data: { reservedQty: { increment: allocation.qty } },
          });
          const reservation = await tx.wmsReservation.create({
            data: {
              salesInvoiceId: invoice.id,
              salesInvoiceLineId: line.id,
              warehouseId: invoice.warehouseId,
              locationId: allocation.stock.locationId,
              itemId: line.itemId,
              qtyReserved: allocation.qty,
              lotCode: allocation.stock.lotCode,
              serialNo: allocation.stock.serialNo,
              expiryDate: allocation.stock.expiryDate,
              status: WmsReservationStatus.RESERVED,
              createdById: userId,
            },
          });
          await this.createMovement(tx, {
            warehouseId: invoice.warehouseId,
            itemId: line.itemId,
            fromLocationId: allocation.stock.locationId,
            movementType: WmsMovementType.RESERVE,
            qty: allocation.qty,
            lotCode: allocation.stock.lotCode,
            serialNo: allocation.stock.serialNo,
            expiryDate: allocation.stock.expiryDate,
            sourceType: 'SALES_INVOICE',
            sourceId: invoice.id,
            referenceNo: invoice.docNo,
            createdById: userId,
          });
          await tx.wmsTask.create({
            data: {
              warehouseId: invoice.warehouseId,
              itemId: line.itemId,
              sourceLocationId: allocation.stock.locationId,
              taskType: WmsTaskType.PICK,
              status: WmsTaskStatus.PENDING,
              qty: allocation.qty,
              lotCode: allocation.stock.lotCode,
              serialNo: allocation.stock.serialNo,
              expiryDate: allocation.stock.expiryDate,
              sourceType: 'SALES_INVOICE',
              sourceId: invoice.id,
              referenceNo: invoice.docNo,
              createdById: userId,
            },
          });
          created.push(reservation);
        }
      }

      return { salesInvoiceId, docNo: invoice.docNo, reservations: created };
    });
  }

  async confirmSalesPick(salesInvoiceId: string, userId: string) {
    const invoice = await this.loadSalesInvoiceForWms(salesInvoiceId);
    const reservations = await this.prisma.wmsReservation.findMany({
      where: { salesInvoiceId, status: WmsReservationStatus.RESERVED },
    });
    if (!reservations.length) {
      throw new BadRequestException('No reserved WMS stock found for this invoice');
    }

    return this.prisma.$transaction(async (tx) => {
      for (const reservation of reservations) {
        const stock = await this.findStock(tx, {
          locationId: reservation.locationId,
          itemId: reservation.itemId,
          lotCode: reservation.lotCode,
          serialNo: reservation.serialNo,
          expiryDate: reservation.expiryDate,
          inventoryStatus: WmsInventoryStatus.AVAILABLE,
        });
        if (!stock || numberValue(stock.reservedQty) < numberValue(reservation.qtyReserved)) {
          throw new BadRequestException('Reserved WMS stock is no longer available');
        }
        await tx.wmsStock.update({
          where: { id: stock.id },
          data: {
            reservedQty: { decrement: reservation.qtyReserved },
            pickedQty: { increment: reservation.qtyReserved },
          },
        });
        await tx.wmsReservation.update({
          where: { id: reservation.id },
          data: {
            status: WmsReservationStatus.PICKED,
            qtyPicked: reservation.qtyReserved,
            pickedAt: new Date(),
          },
        });
        await this.createMovement(tx, {
          warehouseId: reservation.warehouseId,
          itemId: reservation.itemId,
          fromLocationId: reservation.locationId,
          movementType: WmsMovementType.PICK,
          qty: numberValue(reservation.qtyReserved),
          lotCode: reservation.lotCode,
          serialNo: reservation.serialNo,
          expiryDate: reservation.expiryDate,
          sourceType: 'SALES_INVOICE',
          sourceId: invoice.id,
          referenceNo: invoice.docNo,
          createdById: userId,
        });
      }

      await tx.wmsTask.updateMany({
        where: {
          sourceType: 'SALES_INVOICE',
          sourceId: salesInvoiceId,
          taskType: WmsTaskType.PICK,
          status: WmsTaskStatus.PENDING,
        },
        data: { status: WmsTaskStatus.DONE, completedAt: new Date() },
      });

      const packTaskCount = await tx.wmsTask.count({
        where: { sourceType: 'SALES_INVOICE', sourceId: salesInvoiceId, taskType: WmsTaskType.PACK },
      });
      if (packTaskCount === 0) {
        await tx.wmsTask.create({
          data: {
            warehouseId: invoice.warehouseId,
            taskType: WmsTaskType.PACK,
            status: WmsTaskStatus.PENDING,
            sourceType: 'SALES_INVOICE',
            sourceId: invoice.id,
            referenceNo: invoice.docNo,
            notes: 'Pack picked goods before posting/shipping',
            createdById: userId,
          },
        });
      }

      return { salesInvoiceId, docNo: invoice.docNo, picked: reservations.length };
    });
  }

  async releaseSalesPick(salesInvoiceId: string, userId: string) {
    const invoice = await this.loadSalesInvoiceForWms(salesInvoiceId);
    const reservations = await this.prisma.wmsReservation.findMany({
      where: { salesInvoiceId, status: { in: [WmsReservationStatus.RESERVED, WmsReservationStatus.PICKED] } },
    });

    return this.prisma.$transaction(async (tx) => {
      for (const reservation of reservations) {
        const stock = await this.findStock(tx, {
          locationId: reservation.locationId,
          itemId: reservation.itemId,
          lotCode: reservation.lotCode,
          serialNo: reservation.serialNo,
          expiryDate: reservation.expiryDate,
          inventoryStatus: WmsInventoryStatus.AVAILABLE,
        });
        if (stock) {
          if (reservation.status === WmsReservationStatus.PICKED) {
            await tx.wmsStock.update({
              where: { id: stock.id },
              data: { pickedQty: { decrement: reservation.qtyPicked } },
            });
          } else {
            await tx.wmsStock.update({
              where: { id: stock.id },
              data: { reservedQty: { decrement: reservation.qtyReserved } },
            });
          }
        }
        await tx.wmsReservation.update({
          where: { id: reservation.id },
          data: { status: WmsReservationStatus.RELEASED },
        });
        await this.createMovement(tx, {
          warehouseId: reservation.warehouseId,
          itemId: reservation.itemId,
          fromLocationId: reservation.locationId,
          movementType: WmsMovementType.RELEASE,
          qty: numberValue(reservation.qtyReserved),
          lotCode: reservation.lotCode,
          serialNo: reservation.serialNo,
          expiryDate: reservation.expiryDate,
          sourceType: 'SALES_INVOICE',
          sourceId: invoice.id,
          referenceNo: invoice.docNo,
          createdById: userId,
        });
      }

      await tx.wmsTask.updateMany({
        where: { sourceType: 'SALES_INVOICE', sourceId: salesInvoiceId, status: WmsTaskStatus.PENDING },
        data: { status: WmsTaskStatus.CANCELLED },
      });

      return { salesInvoiceId, released: reservations.length };
    });
  }

  async packSalesInvoice(salesInvoiceId: string, userId: string) {
    const invoice = await this.loadSalesInvoiceForWms(salesInvoiceId);
    await this.assertSalesInvoicePicked(invoice);

    const existing = await this.prisma.wmsTask.findFirst({
      where: {
        sourceType: 'SALES_INVOICE',
        sourceId: salesInvoiceId,
        taskType: WmsTaskType.PACK,
        status: WmsTaskStatus.DONE,
      },
    });
    if (existing) return { salesInvoiceId, docNo: invoice.docNo, packed: true };

    await this.prisma.wmsTask.create({
      data: {
        warehouseId: invoice.warehouseId,
        taskType: WmsTaskType.PACK,
        status: WmsTaskStatus.DONE,
        sourceType: 'SALES_INVOICE',
        sourceId: invoice.id,
        referenceNo: invoice.docNo,
        notes: 'Packed for shipment',
        createdById: userId,
        completedAt: new Date(),
      },
    });

    return { salesInvoiceId, docNo: invoice.docNo, packed: true };
  }

  async createCycleCountPlan(dto: WmsCycleCountPlanDto, userId: string) {
    await this.ensureWarehouse(dto.warehouseId);
    const referenceNo = nullableText(dto.referenceNo) ?? `CYCLE-${Date.now()}`;
    const rows = await this.prisma.wmsStock.findMany({
      where: {
        warehouseId: dto.warehouseId,
        ...(dto.locationId ? { locationId: dto.locationId } : {}),
        ...(dto.itemId ? { itemId: dto.itemId } : {}),
      },
      include: { location: true },
      orderBy: [{ location: { code: 'asc' } }, { item: { name: 'asc' } }],
    });

    if (!rows.length && (!dto.locationId || !dto.itemId)) {
      throw new BadRequestException('No WMS stock found for cycle count plan');
    }

    const tasks = rows.length
      ? rows.map((row) => ({
          warehouseId: row.warehouseId,
          itemId: row.itemId,
          sourceLocationId: row.locationId,
          taskType: WmsTaskType.COUNT,
          status: WmsTaskStatus.PENDING,
          qty: row.qtyOnHand,
          lotCode: row.lotCode,
          serialNo: row.serialNo,
          expiryDate: row.expiryDate,
          referenceNo,
          notes: nullableText(dto.notes),
          createdById: userId,
        }))
      : [
          {
            warehouseId: dto.warehouseId,
            itemId: dto.itemId,
            sourceLocationId: dto.locationId,
            taskType: WmsTaskType.COUNT,
            status: WmsTaskStatus.PENDING,
            referenceNo,
            notes: nullableText(dto.notes),
            createdById: userId,
          },
        ];

    await this.prisma.wmsTask.createMany({ data: tasks });
    return { referenceNo, tasks: tasks.length };
  }

  async startTask(id: string, dto: WmsTaskActionDto, userId: string) {
    return this.updateTaskStatus(id, WmsTaskStatus.IN_PROGRESS, userId, dto ?? {});
  }

  async completeTask(id: string, dto: WmsTaskActionDto, userId: string) {
    return this.updateTaskStatus(id, WmsTaskStatus.DONE, userId, dto ?? {});
  }

  async cancelTask(id: string, dto: WmsTaskActionDto, userId: string) {
    return this.updateTaskStatus(id, WmsTaskStatus.CANCELLED, userId, dto ?? {});
  }

  async shortTask(id: string, dto: WmsTaskActionDto, userId: string) {
    return this.updateTaskStatus(id, WmsTaskStatus.SHORT, userId, dto ?? {});
  }

  async markExpiredStock(userId: string) {
    const rows = await this.prisma.wmsStock.findMany({
      where: {
        inventoryStatus: WmsInventoryStatus.AVAILABLE,
        expiryDate: { not: null, lt: todayUtcDate() },
        reservedQty: 0,
        pickedQty: 0,
        qtyOnHand: { gt: 0 },
      },
    });
    const referenceNo = `EXP-${Date.now()}`;

    await this.prisma.$transaction(async (tx) => {
      for (const row of rows) {
        await tx.wmsStock.update({
          where: { id: row.id },
          data: { inventoryStatus: WmsInventoryStatus.EXPIRED },
        });
        await this.createMovement(tx, {
          warehouseId: row.warehouseId,
          itemId: row.itemId,
          fromLocationId: row.locationId,
          toLocationId: row.locationId,
          movementType: WmsMovementType.EXPIRE,
          qty: numberValue(row.qtyOnHand),
          lotCode: row.lotCode,
          serialNo: row.serialNo,
          expiryDate: row.expiryDate,
          referenceNo,
          notes: 'Automatically marked as expired',
          createdById: userId,
        });
        await tx.wmsTask.create({
          data: {
            warehouseId: row.warehouseId,
            itemId: row.itemId,
            sourceLocationId: row.locationId,
            taskType: WmsTaskType.QC,
            status: WmsTaskStatus.DONE,
            qty: row.qtyOnHand,
            lotCode: row.lotCode,
            serialNo: row.serialNo,
            expiryDate: row.expiryDate,
            referenceNo,
            notes: 'Expired inventory blocked from sales',
            createdById: userId,
            completedAt: new Date(),
          },
        });
      }
    });

    return {
      referenceNo,
      rows: rows.length,
      qtyOnHand: roundQty(rows.reduce((sum, row) => sum + numberValue(row.qtyOnHand), 0)),
    };
  }

  async ensureSalesInvoiceReadyToPost(invoice: SalesInvoiceForWms) {
    await this.assertSalesInvoicePicked(invoice);
    const packed = await this.prisma.wmsTask.findFirst({
      where: {
        sourceType: 'SALES_INVOICE',
        sourceId: invoice.id,
        taskType: WmsTaskType.PACK,
        status: WmsTaskStatus.DONE,
      },
    });
    if (!packed) {
      throw new BadRequestException(
        `Sales invoice ${invoice.docNo} cannot be posted before WMS packing is completed`,
      );
    }
  }

  async shipSalesInvoiceTx(tx: Tx, invoice: SalesInvoiceForWms, userId: string) {
    const reservations = await tx.wmsReservation.findMany({
      where: { salesInvoiceId: invoice.id, status: WmsReservationStatus.PICKED },
    });
    for (const reservation of reservations) {
      const qty = numberValue(reservation.qtyPicked);
      const stock = await this.findStock(tx, {
        locationId: reservation.locationId,
        itemId: reservation.itemId,
        lotCode: reservation.lotCode,
        serialNo: reservation.serialNo,
        expiryDate: reservation.expiryDate,
        inventoryStatus: WmsInventoryStatus.AVAILABLE,
      });
      if (!stock || numberValue(stock.pickedQty) < qty || numberValue(stock.qtyOnHand) < qty) {
        throw new BadRequestException('Picked WMS stock is not available for shipping');
      }

      await tx.wmsStock.update({
        where: { id: stock.id },
        data: {
          qtyOnHand: { decrement: qty },
          pickedQty: { decrement: qty },
        },
      });
      await tx.wmsReservation.update({
        where: { id: reservation.id },
        data: {
          status: WmsReservationStatus.SHIPPED,
          shippedAt: new Date(),
        },
      });
      await this.createMovement(tx, {
        warehouseId: reservation.warehouseId,
        itemId: reservation.itemId,
        fromLocationId: reservation.locationId,
        movementType: WmsMovementType.SHIP,
        qty,
        lotCode: reservation.lotCode,
        serialNo: reservation.serialNo,
        expiryDate: reservation.expiryDate,
        sourceType: 'SALES_INVOICE',
        sourceId: invoice.id,
        referenceNo: invoice.docNo,
        createdById: userId,
      });
    }
    await tx.wmsTask.create({
      data: {
        warehouseId: invoice.warehouseId,
        taskType: WmsTaskType.SHIP,
        status: WmsTaskStatus.DONE,
        sourceType: 'SALES_INVOICE',
        sourceId: invoice.id,
        referenceNo: invoice.docNo,
        notes: 'Shipped after sales invoice posting',
        createdById: userId,
        completedAt: new Date(),
      },
    });
  }

  async scan(code: string) {
    const search = code.trim();
    if (!search) throw new BadRequestException('Barcode or code is required');
    const [items, locations, stocks] = await Promise.all([
      this.prisma.item.findMany({
        where: {
          OR: [
            { code: { equals: search, mode: 'insensitive' } },
            { barcode: { equals: search, mode: 'insensitive' } },
          ],
        },
        take: 10,
      }),
      this.prisma.wmsLocation.findMany({
        where: {
          OR: [
            { code: { equals: search, mode: 'insensitive' } },
            { barcode: { equals: search, mode: 'insensitive' } },
          ],
        },
        include: { warehouse: true },
        take: 10,
      }),
      this.prisma.wmsStock.findMany({
        where: {
          OR: [
            { lotCode: { equals: search, mode: 'insensitive' } },
            { serialNo: { equals: search, mode: 'insensitive' } },
          ],
        },
        include: { item: true, location: true, warehouse: true },
        take: 10,
      }),
    ]);
    return { items, locations, stocks };
  }

  private async assertSalesInvoicePicked(invoice: SalesInvoiceForWms) {
    const reservations = await this.prisma.wmsReservation.findMany({
      where: { salesInvoiceId: invoice.id, status: WmsReservationStatus.PICKED },
    });
    for (const line of invoice.lines) {
      const pickedQty = reservations
        .filter((reservation) => reservation.salesInvoiceLineId === line.id)
        .reduce((sum, reservation) => sum + numberValue(reservation.qtyPicked), 0);
      if (roundQty(pickedQty) < numberValue(line.qty)) {
        throw new BadRequestException(
          `Sales invoice ${invoice.docNo} cannot be posted before WMS picking is completed`,
        );
      }
    }
  }

  private async updateTaskStatus(
    id: string,
    status: WmsTaskStatus,
    userId: string,
    dto: WmsTaskActionDto = {},
  ) {
    const task = await this.prisma.wmsTask.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('WMS task not found');
    if (task.status === WmsTaskStatus.DONE || task.status === WmsTaskStatus.CANCELLED) {
      throw new BadRequestException('Closed WMS tasks cannot be changed');
    }

    return this.prisma.wmsTask.update({
      where: { id },
      data: {
        status,
        assignedToId: status === WmsTaskStatus.IN_PROGRESS ? userId : task.assignedToId,
        notes: nullableText(dto.notes) ?? task.notes,
        completedAt:
          status === WmsTaskStatus.DONE ||
          status === WmsTaskStatus.CANCELLED ||
          status === WmsTaskStatus.SHORT
            ? new Date()
            : task.completedAt,
      },
      include: {
        warehouse: true,
        item: true,
        sourceLocation: true,
        destinationLocation: true,
      },
    });
  }

  private async executeStockMove(
    dto: WmsMoveDto,
    userId: string,
    config: {
      movementType: WmsMovementType;
      taskType: WmsTaskType;
      referencePrefix: string;
      sourceLocationTypes?: WmsLocationType[];
      destinationLocationTypes?: WmsLocationType[];
    },
  ) {
    const qty = Number(dto.serialNo ? 1 : dto.qty);
    if (!Number.isFinite(qty) || qty <= 0) throw new BadRequestException('Quantity is required');
    if (dto.fromLocationId === dto.toLocationId) {
      throw new BadRequestException('Source and destination locations must be different');
    }

    const [fromLocation, toLocation] = await Promise.all([
      this.getActiveLocation(dto.fromLocationId),
      this.getActiveLocation(dto.toLocationId),
    ]);
    if (fromLocation.warehouseId !== toLocation.warehouseId) {
      throw new BadRequestException('Locations must belong to the same warehouse');
    }
    if (config.sourceLocationTypes && !config.sourceLocationTypes.includes(fromLocation.locationType)) {
      throw new BadRequestException('Source location type is not valid for this WMS workflow');
    }
    if (
      config.destinationLocationTypes &&
      !config.destinationLocationTypes.includes(toLocation.locationType)
    ) {
      throw new BadRequestException('Destination location type is not valid for this WMS workflow');
    }

    const lotCode = nullableText(dto.lotCode);
    const serialNo = nullableText(dto.serialNo);
    const expiryDate = dateOnly(dto.expiryDate);
    const referenceNo = nullableText(dto.referenceNo) ?? `${config.referencePrefix}-${Date.now()}`;

    return this.prisma.$transaction(async (tx) => {
      if (serialNo) {
        const source = await this.findStock(tx, {
          locationId: fromLocation.id,
          itemId: dto.itemId,
          lotCode,
          serialNo,
          expiryDate,
          inventoryStatus: WmsInventoryStatus.AVAILABLE,
        });
        this.assertAvailable(source, qty);
        await tx.wmsStock.update({
          where: { id: source.id },
          data: { locationId: toLocation.id, warehouseId: toLocation.warehouseId },
        });
      } else {
        const source = await this.decreaseStock(tx, {
          locationId: fromLocation.id,
          itemId: dto.itemId,
          qty,
          lotCode,
          serialNo,
          expiryDate,
          inventoryStatus: WmsInventoryStatus.AVAILABLE,
        });
        await this.increaseStock(tx, {
          warehouseId: toLocation.warehouseId,
          locationId: toLocation.id,
          itemId: dto.itemId,
          qty,
          lotCode: source.lotCode,
          serialNo: source.serialNo,
          expiryDate: source.expiryDate,
          manufacturingDate: source.manufacturingDate,
          inventoryStatus: source.inventoryStatus,
        });
      }

      await this.createMovement(tx, {
        warehouseId: fromLocation.warehouseId,
        itemId: dto.itemId,
        fromLocationId: fromLocation.id,
        toLocationId: toLocation.id,
        movementType: config.movementType,
        qty,
        lotCode,
        serialNo,
        expiryDate,
        referenceNo,
        notes: nullableText(dto.notes),
        createdById: userId,
      });

      await tx.wmsTask.create({
        data: {
          warehouseId: fromLocation.warehouseId,
          itemId: dto.itemId,
          sourceLocationId: fromLocation.id,
          destinationLocationId: toLocation.id,
          taskType: config.taskType,
          status: WmsTaskStatus.DONE,
          qty,
          lotCode,
          serialNo,
          expiryDate,
          referenceNo,
          notes: nullableText(dto.notes),
          createdById: userId,
          completedAt: new Date(),
        },
      });

      return { referenceNo };
    });
  }

  private async ensureWarehouse(id: string) {
    const record = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('Warehouse not found');
    return record;
  }

  private async ensureItem(id: string) {
    const record = await this.prisma.item.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('Item not found');
    return record;
  }

  private async getActiveLocation(id: string) {
    const location = await this.prisma.wmsLocation.findUnique({ where: { id } });
    if (!location) throw new NotFoundException('WMS location not found');
    if (location.status !== WmsLocationStatus.ACTIVE && location.status !== WmsLocationStatus.QUARANTINE) {
      throw new BadRequestException('WMS location is not active');
    }
    return location;
  }

  private async loadSalesInvoiceForWms(id: string): Promise<SalesInvoiceForWms> {
    const invoice = await this.prisma.salesInvoice.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!invoice) throw new NotFoundException('Sales invoice not found');
    return invoice;
  }

  private async allocateAvailableStock(
    tx: Tx,
    params: { warehouseId: string; itemId: string; qtyNeeded: number },
  ) {
    const rows = await tx.wmsStock.findMany({
      where: {
        warehouseId: params.warehouseId,
        itemId: params.itemId,
        inventoryStatus: WmsInventoryStatus.AVAILABLE,
        qtyOnHand: { gt: 0 },
        location: {
          status: WmsLocationStatus.ACTIVE,
          locationType: { in: [WmsLocationType.PICKING, WmsLocationType.STORAGE] },
        },
        OR: [{ expiryDate: null }, { expiryDate: { gte: todayUtcDate() } }],
      },
      include: { location: true },
    });
    const sorted = rows.sort((left, right) => {
      const leftDate = left.expiryDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const rightDate = right.expiryDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      if (leftDate !== rightDate) return leftDate - rightDate;
      return left.createdAt.getTime() - right.createdAt.getTime();
    });

    let remaining = params.qtyNeeded;
    const allocations: Array<{ stock: any; qty: number }> = [];
    for (const stock of sorted) {
      const available = roundQty(
        numberValue(stock.qtyOnHand) - numberValue(stock.reservedQty) - numberValue(stock.pickedQty),
      );
      if (available <= 0) continue;
      const qty = Math.min(available, remaining);
      allocations.push({ stock, qty });
      remaining = roundQty(remaining - qty);
      if (remaining <= 0) break;
    }
    return allocations;
  }

  private async findStock(
    tx: Tx,
    params: {
      locationId: string;
      itemId: string;
      lotCode?: string | null;
      serialNo?: string | null;
      expiryDate?: Date | string | null;
      inventoryStatus?: WmsInventoryStatus;
    },
  ) {
    return tx.wmsStock.findFirst({
      where: {
        locationId: params.locationId,
        itemId: params.itemId,
        lotCode: params.lotCode ?? null,
        serialNo: params.serialNo ?? null,
        expiryDate: params.expiryDate ? new Date(params.expiryDate) : null,
        ...(params.inventoryStatus ? { inventoryStatus: params.inventoryStatus } : {}),
      },
    });
  }

  private async increaseStock(
    tx: Tx,
    params: {
      warehouseId: string;
      locationId: string;
      itemId: string;
      qty: number;
      lotCode?: string | null;
      serialNo?: string | null;
      expiryDate?: Date | null;
      manufacturingDate?: Date | null;
      inventoryStatus: WmsInventoryStatus;
    },
  ) {
    const existing = await this.findStock(tx, params);
    if (existing) {
      return tx.wmsStock.update({
        where: { id: existing.id },
        data: { qtyOnHand: { increment: params.qty } },
      });
    }

    return tx.wmsStock.create({
      data: {
        warehouseId: params.warehouseId,
        locationId: params.locationId,
        itemId: params.itemId,
        qtyOnHand: params.qty,
        lotCode: params.lotCode,
        serialNo: params.serialNo,
        expiryDate: params.expiryDate,
        manufacturingDate: params.manufacturingDate,
        inventoryStatus: params.inventoryStatus,
      },
    });
  }

  private async decreaseStock(
    tx: Tx,
    params: {
      locationId: string;
      itemId: string;
      qty: number;
      lotCode?: string | null;
      serialNo?: string | null;
      expiryDate?: Date | null;
      inventoryStatus: WmsInventoryStatus;
    },
  ) {
    const stock = await this.findStock(tx, params);
    this.assertAvailable(stock, params.qty);
    await tx.wmsStock.update({
      where: { id: stock.id },
      data: { qtyOnHand: { decrement: params.qty } },
    });
    return stock;
  }

  private assertAvailable(stock: any, qty: number) {
    if (!stock) throw new NotFoundException('WMS stock not found');
    const available = roundQty(
      numberValue(stock.qtyOnHand) - numberValue(stock.reservedQty) - numberValue(stock.pickedQty),
    );
    if (available < qty) throw new BadRequestException('Insufficient available WMS stock');
  }

  private async createMovement(
    tx: Tx,
    params: {
      warehouseId: string;
      itemId: string;
      movementType: WmsMovementType;
      qty: number;
      fromLocationId?: string | null;
      toLocationId?: string | null;
      lotCode?: string | null;
      serialNo?: string | null;
      expiryDate?: Date | string | null;
      sourceType?: string | null;
      sourceId?: string | null;
      referenceNo?: string | null;
      notes?: string | null;
      createdById?: string | null;
    },
  ) {
    return tx.wmsMovement.create({
      data: {
        warehouseId: params.warehouseId,
        itemId: params.itemId,
        fromLocationId: params.fromLocationId ?? null,
        toLocationId: params.toLocationId ?? null,
        movementType: params.movementType,
        qty: params.qty,
        lotCode: params.lotCode ?? null,
        serialNo: params.serialNo ?? null,
        expiryDate: params.expiryDate ? new Date(params.expiryDate) : null,
        sourceType: params.sourceType ?? null,
        sourceId: params.sourceId ?? null,
        referenceNo: params.referenceNo ?? null,
        notes: params.notes ?? null,
        createdById: params.createdById ?? null,
      },
    });
  }

  private buildBalanceSummary(rows: any[]) {
    const warehouseIds = new Set<string>();
    const locationIds = new Set<string>();
    const itemIds = new Set<string>();
    let qtyOnHand = 0;
    let reservedQty = 0;
    let pickedQty = 0;
    const byStatus = rows.reduce<Record<string, number>>((acc, row) => {
      warehouseIds.add(row.warehouseId);
      locationIds.add(row.locationId);
      itemIds.add(row.itemId);
      qtyOnHand += numberValue(row.qtyOnHand);
      reservedQty += numberValue(row.reservedQty);
      pickedQty += numberValue(row.pickedQty);
      acc[row.inventoryStatus] = (acc[row.inventoryStatus] ?? 0) + numberValue(row.qtyOnHand);
      return acc;
    }, {});
    return {
      warehouseCount: warehouseIds.size,
      locationCount: locationIds.size,
      itemCount: itemIds.size,
      qtyOnHand: roundQty(qtyOnHand),
      reservedQty: roundQty(reservedQty),
      pickedQty: roundQty(pickedQty),
      availableQty: roundQty(qtyOnHand - reservedQty - pickedQty),
      byStatus,
    };
  }

  private resolveLocationType(value: string | undefined, fallback: WmsLocationType) {
    if (!value) return fallback;
    if (!Object.values(WmsLocationType).includes(value as WmsLocationType)) {
      throw new BadRequestException('Invalid WMS location type');
    }
    return value as WmsLocationType;
  }

  private resolveLocationStatus(value: string | undefined, fallback: WmsLocationStatus) {
    if (!value) return fallback;
    if (!Object.values(WmsLocationStatus).includes(value as WmsLocationStatus)) {
      throw new BadRequestException('Invalid WMS location status');
    }
    return value as WmsLocationStatus;
  }

  private resolveInventoryStatus(value: string | undefined, fallback: WmsInventoryStatus) {
    if (!value) return fallback;
    if (!Object.values(WmsInventoryStatus).includes(value as WmsInventoryStatus)) {
      throw new BadRequestException('Invalid WMS inventory status');
    }
    return value as WmsInventoryStatus;
  }
}
