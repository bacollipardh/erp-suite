import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentStatus, MovementType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { StockService } from '../stock/stock.service';
import { buildDocNo } from '../common/utils/series';
import { round2 } from '../common/utils/money';
import { CreatePurchaseInvoiceDto } from './dto/create-purchase-invoice.dto';
import { UpdatePurchaseInvoiceDto } from './dto/update-purchase-invoice.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { toPaginatedResponse, toPagination } from '../common/utils/pagination';
import {
  calculateOutstandingAmount,
  resolveDueState,
  resolvePaymentStatus,
} from '../common/utils/payments';
import { RecordPaymentDto } from '../common/dto/record-payment.dto';

@Injectable()
export class PurchaseInvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async findAll(query: PaginationDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { skip, take } = toPagination(page, limit);
    const search = query.search?.trim();

    const where = search
      ? {
          OR: [
            { docNo: { contains: search, mode: 'insensitive' as const } },
            { supplier: { name: { contains: search, mode: 'insensitive' as const } } },
            { warehouse: { name: { contains: search, mode: 'insensitive' as const } } },
            { supplierInvoiceNo: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : undefined;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.purchaseInvoice.findMany({
        where,
        include: {
          supplier: true,
          warehouse: true,
          series: true,
          createdBy: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.purchaseInvoice.count({ where }),
    ]);

    return toPaginatedResponse({
      items: items.map((item) => this.enrichDocumentState(item)),
      total,
      page,
      limit,
    });
  }

  async findOne(id: string) {
    const doc = await this.findOneWithoutPayments(id);
    const payments = await this.getPayments(id);

    return {
      ...this.enrichDocumentState(doc),
      payments,
    };
  }

  private calculateLines(lines: CreatePurchaseInvoiceDto['lines']) {
    const mapped = lines.map((line, index) => {
      const grossBase = Number(line.qty) * Number(line.unitPrice);
      const discountFromPercent = grossBase * (Number(line.discountPercent ?? 0) / 100);
      const discountAmount = round2(Number(line.discountAmount ?? 0) + discountFromPercent);
      const netAmount = round2(grossBase - discountAmount);
      const taxAmount = round2(netAmount * (Number(line.taxPercent) / 100));
      const grossAmount = round2(netAmount + taxAmount);

      return {
        lineNo: index + 1,
        itemId: line.itemId,
        description: line.description,
        qty: Number(line.qty),
        unitPrice: Number(line.unitPrice),
        discountPercent: Number(line.discountPercent ?? 0),
        discountAmount,
        taxPercent: Number(line.taxPercent),
        netAmount,
        taxAmount,
        grossAmount,
      };
    });

    const subtotal = round2(mapped.reduce((a, b) => a + Number(b.netAmount), 0));
    const discountTotal = round2(mapped.reduce((a, b) => a + Number(b.discountAmount), 0));
    const taxTotal = round2(mapped.reduce((a, b) => a + Number(b.taxAmount), 0));
    const grandTotal = round2(mapped.reduce((a, b) => a + Number(b.grossAmount), 0));

    return { lines: mapped, subtotal, discountTotal, taxTotal, grandTotal };
  }

  private validateDueDate(docDate: string, dueDate?: string) {
    if (!dueDate) return;

    if (new Date(dueDate).getTime() < new Date(docDate).getTime()) {
      throw new BadRequestException('Due date cannot be earlier than document date');
    }
  }

  private enrichDocumentState<
    T extends {
      grandTotal: unknown;
      amountPaid?: unknown;
      dueDate?: Date | null;
      paymentStatus?: unknown;
    },
  >(
    doc: T,
  ) {
    const settlementTotal = round2(Number(doc.grandTotal ?? 0));
    const settlementStatus = resolvePaymentStatus(
      settlementTotal,
      Number(doc.amountPaid ?? 0),
    );
    const outstandingAmount = calculateOutstandingAmount(
      settlementTotal,
      Number(doc.amountPaid ?? 0),
    );
    const { dueState, daysPastDue } = resolveDueState({
      dueDate: doc.dueDate,
      outstandingAmount,
      paymentStatus: settlementStatus,
    });

    return {
      ...doc,
      settlementTotal,
      settlementStatus,
      outstandingAmount,
      dueState,
      daysPastDue,
    };
  }

  private async findOneWithoutPayments(id: string) {
    const doc = await this.prisma.purchaseInvoice.findUnique({
      where: { id },
      include: {
        supplier: true,
        warehouse: true,
        series: true,
        createdBy: true,
        postedBy: true,
        lines: { include: { item: true } },
      },
    });
    if (!doc) throw new NotFoundException('Purchase invoice not found');
    return doc;
  }

  async getPayments(id: string) {
    await this.findOneWithoutPayments(id);

    const entries = await this.auditLogs.findEntityLogs({
      entityType: 'purchase_invoices',
      entityId: id,
      action: 'RECORD_PAYMENT',
      limit: 100,
    });

    return entries.map((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt,
      amount: Number((entry.metadata as any)?.amount ?? 0),
      paidAt: (entry.metadata as any)?.paidAt ?? entry.createdAt,
      referenceNo: (entry.metadata as any)?.referenceNo ?? null,
      notes: (entry.metadata as any)?.notes ?? null,
      user: entry.user,
    }));
  }

  private async validateDraftInput(
    dto: Pick<
      CreatePurchaseInvoiceDto,
      'seriesId' | 'supplierId' | 'warehouseId' | 'docDate' | 'dueDate' | 'lines'
    >,
    tx: Prisma.TransactionClient,
  ) {
    this.validateDueDate(dto.docDate, dto.dueDate);

    const [series, supplier, warehouse] = await Promise.all([
      tx.documentSeries.findUnique({ where: { id: dto.seriesId } }),
      tx.supplier.findUnique({ where: { id: dto.supplierId } }),
      tx.warehouse.findUnique({ where: { id: dto.warehouseId } }),
    ]);

    if (!series || series.documentType !== 'PURCHASE_INVOICE' || !series.isActive) {
      throw new BadRequestException('Purchase invoice series not found or inactive');
    }

    if (!supplier || !supplier.isActive) {
      throw new BadRequestException('Supplier not found or inactive');
    }

    if (!warehouse || !warehouse.isActive) {
      throw new BadRequestException('Warehouse not found or inactive');
    }

    const uniqueItemIds = [...new Set(dto.lines.map((line) => line.itemId))];
    const items = await tx.item.findMany({
      where: { id: { in: uniqueItemIds } },
      select: { id: true, isActive: true },
    });

    if (items.length !== uniqueItemIds.length) {
      throw new BadRequestException('One or more purchase invoice items were not found');
    }

    if (items.some((item) => !item.isActive)) {
      throw new BadRequestException('Purchase invoice contains inactive items');
    }
  }

  private toDraftLineInput(existing: Awaited<ReturnType<PurchaseInvoicesService['findOneWithoutPayments']>>) {
    return existing.lines.map((line) => ({
      itemId: line.itemId,
      description: line.description ?? undefined,
      qty: Number(line.qty),
      unitPrice: Number(line.unitPrice),
      discountPercent: Number(line.discountPercent ?? 0),
      discountAmount: Number(line.discountAmount ?? 0),
      taxPercent: Number(line.taxPercent),
    }));
  }

  async create(dto: CreatePurchaseInvoiceDto, userId: string) {
    const calc = this.calculateLines(dto.lines);

    const doc = await this.prisma.$transaction(async (tx) => {
      await this.validateDraftInput(dto, tx);

      const series = await tx.documentSeries.findUnique({ where: { id: dto.seriesId } });
      if (!series) throw new BadRequestException('Series not found');

      const docNo = buildDocNo(series.prefix, series.nextNumber);

      const created = await tx.purchaseInvoice.create({
        data: {
          seriesId: dto.seriesId,
          supplierId: dto.supplierId,
          warehouseId: dto.warehouseId,
          docNo,
          supplierInvoiceNo: dto.supplierInvoiceNo,
          docDate: new Date(dto.docDate),
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          status: DocumentStatus.DRAFT,
          subtotal: calc.subtotal,
          discountTotal: calc.discountTotal,
          taxTotal: calc.taxTotal,
          grandTotal: calc.grandTotal,
          notes: dto.notes,
          createdById: userId,
          lines: {
            create: calc.lines,
          },
        },
        include: { lines: true },
      });

      await tx.documentSeries.update({
        where: { id: dto.seriesId },
        data: { nextNumber: { increment: 1 } },
      });

      return created;
    });

    await this.auditLogs.log({
      userId,
      entityType: 'purchase_invoices',
      entityId: doc.id,
      action: 'CREATE_DRAFT',
      metadata: { docNo: doc.docNo },
    });

    return doc;
  }

  async update(id: string, dto: UpdatePurchaseInvoiceDto) {
    const existing = await this.findOne(id);
    if (existing.status !== DocumentStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT purchase invoice can be updated');
    }

    if (dto.seriesId && dto.seriesId !== existing.seriesId) {
      throw new BadRequestException('Series cannot be changed after draft creation');
    }

    return this.prisma.$transaction(async (tx) => {
      let calc: ReturnType<PurchaseInvoicesService['calculateLines']> | null = null;
      const draftInput = {
        seriesId: existing.seriesId,
        supplierId: dto.supplierId ?? existing.supplierId,
        warehouseId: dto.warehouseId ?? existing.warehouseId,
        docDate: dto.docDate ?? String(existing.docDate).slice(0, 10),
        dueDate:
          dto.dueDate === undefined
            ? existing.dueDate
              ? String(existing.dueDate).slice(0, 10)
              : undefined
            : dto.dueDate,
        lines: dto.lines ?? this.toDraftLineInput(existing),
      };

      await this.validateDraftInput(draftInput, tx);

      if (dto.lines?.length) {
        calc = this.calculateLines(dto.lines);
        await tx.purchaseInvoiceLine.deleteMany({ where: { purchaseInvoiceId: id } });
      }

      const updated = await tx.purchaseInvoice.update({
        where: { id },
        data: {
          supplierId: dto.supplierId,
          warehouseId: dto.warehouseId,
          supplierInvoiceNo: dto.supplierInvoiceNo,
          docDate: dto.docDate ? new Date(dto.docDate) : undefined,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          notes: dto.notes,
          subtotal: calc?.subtotal,
          discountTotal: calc?.discountTotal,
          taxTotal: calc?.taxTotal,
          grandTotal: calc?.grandTotal,
          lines: calc
            ? {
                create: calc.lines,
              }
            : undefined,
        },
        include: { lines: true },
      });

      await this.auditLogs.log({
        entityType: 'purchase_invoices',
        entityId: updated.id,
        action: 'UPDATE_DRAFT',
        metadata: dto,
      });

      return updated;
    });
  }

  async post(id: string, postedById: string) {
    const existing = await this.findOne(id);
    if (existing.status !== DocumentStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT purchase invoice can be posted');
    }

    const doc = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.purchaseInvoice.update({
        where: { id },
        data: {
          status: DocumentStatus.POSTED,
          postedById,
          postedAt: new Date(),
        },
        include: { lines: true },
      });

      for (const line of updated.lines) {
        await this.stockService.applyMovement(tx, {
          warehouseId: updated.warehouseId,
          itemId: line.itemId,
          movementType: MovementType.PURCHASE_IN,
          qtyIn: Number(line.qty),
          unitCost: Number(line.unitPrice),
          purchaseInvoiceId: updated.id,
          referenceNo: updated.docNo,
          movementAt: new Date(),
        });
      }

      return updated;
    });

    await this.auditLogs.log({
      userId: postedById,
      entityType: 'purchase_invoices',
      entityId: doc.id,
      action: 'POST',
      metadata: { docNo: doc.docNo },
    });

    return doc;
  }

  async recordPayment(id: string, dto: RecordPaymentDto, userId: string) {
    const existing = await this.findOne(id);
    if (existing.status === DocumentStatus.DRAFT) {
      throw new BadRequestException('Only posted purchase invoices can receive payments');
    }

    const total = Number(existing.grandTotal);
    const currentPaid = Number(existing.amountPaid ?? 0);
    const nextPaid = round2(currentPaid + Number(dto.amount));

    if (nextPaid > total) {
      throw new BadRequestException('Payment exceeds the remaining payable amount');
    }

    const updated = await this.prisma.purchaseInvoice.update({
      where: { id },
      data: {
        amountPaid: nextPaid,
        paymentStatus: resolvePaymentStatus(total, nextPaid),
      },
    });

    await this.auditLogs.log({
      userId,
      entityType: 'purchase_invoices',
      entityId: updated.id,
      action: 'RECORD_PAYMENT',
      metadata: {
        amount: dto.amount,
        paidAt: dto.paidAt ?? new Date().toISOString(),
        referenceNo: dto.referenceNo,
        notes: dto.notes,
        remainingAmount: calculateOutstandingAmount(total, nextPaid),
        paymentStatusAfter: resolvePaymentStatus(total, nextPaid),
      },
    });

    return this.enrichDocumentState(updated);
  }
}
