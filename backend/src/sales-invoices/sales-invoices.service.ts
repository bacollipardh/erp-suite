import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentStatus, MovementType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { buildDocNo } from '../common/utils/series';
import { round2 } from '../common/utils/money';
import { CreateSalesInvoiceDto } from './dto/create-sales-invoice.dto';
import { UpdateSalesInvoiceDto } from './dto/update-sales-invoice.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { toPaginatedResponse, toPagination } from '../common/utils/pagination';
import {
  buildPaymentTimeline,
  calculatePaymentAllocation,
  calculateOutstandingAmount,
  resolveDueState,
  resolvePaymentStatus,
} from '../common/utils/payments';
import { RecordPaymentDto } from '../common/dto/record-payment.dto';

@Injectable()
export class SalesInvoicesService {
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
            { customer: { name: { contains: search, mode: 'insensitive' as const } } },
            { warehouse: { name: { contains: search, mode: 'insensitive' as const } } },
          ],
        }
      : undefined;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.salesInvoice.findMany({
        where,
        include: {
          customer: true,
          warehouse: true,
          paymentMethod: true,
          series: true,
          createdBy: true,
          returns: {
            where: { status: DocumentStatus.POSTED },
            select: { id: true, grandTotal: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.salesInvoice.count({ where }),
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

  private calculateLines(lines: CreateSalesInvoiceDto['lines']) {
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

  private calculateCreditedAmount(doc: { returns?: { grandTotal: unknown }[] }) {
    return round2(
      (doc.returns ?? []).reduce((total, entry) => total + Number(entry.grandTotal ?? 0), 0),
    );
  }

  private enrichDocumentState<
    T extends {
      grandTotal: unknown;
      amountPaid?: unknown;
      dueDate?: Date | null;
      paymentStatus?: unknown;
      returns?: { grandTotal: unknown }[];
    },
  >(
    doc: T,
  ) {
    const creditedAmount = this.calculateCreditedAmount(doc);
    const settlementTotal = round2(Math.max(0, Number(doc.grandTotal ?? 0) - creditedAmount));
    const outstandingAmount = calculateOutstandingAmount(
      settlementTotal,
      Number(doc.amountPaid ?? 0),
    );
    const settlementStatus = resolvePaymentStatus(settlementTotal, Number(doc.amountPaid ?? 0));
    const { dueState, daysPastDue } = resolveDueState({
      dueDate: doc.dueDate,
      outstandingAmount,
      paymentStatus: settlementStatus,
    });

    return {
      ...doc,
      creditedAmount,
      settlementTotal,
      settlementStatus,
      outstandingAmount,
      dueState,
      daysPastDue,
    };
  }

  async getPayments(id: string) {
    const doc = this.enrichDocumentState(await this.findOneWithoutPayments(id));

    const entries = await this.auditLogs.findEntityLogs({
      entityType: 'sales_invoices',
      entityId: id,
      action: 'RECORD_PAYMENT',
      limit: 100,
    });

    return buildPaymentTimeline({
      entries,
      settlementTotal: Number(doc.settlementTotal ?? doc.grandTotal ?? 0),
    });
  }

  private async findOneWithoutPayments(id: string) {
    const doc = await this.prisma.salesInvoice.findUnique({
      where: { id },
      include: {
        customer: true,
        warehouse: true,
        paymentMethod: true,
        series: true,
        createdBy: true,
        postedBy: true,
        lines: { include: { item: true } },
        returns: {
          where: { status: DocumentStatus.POSTED },
          select: { id: true, grandTotal: true, docNo: true, status: true, createdAt: true },
        },
      },
    });
    if (!doc) throw new NotFoundException('Sales invoice not found');
    return doc;
  }

  private async validateDraftInput(
    dto: Pick<
      CreateSalesInvoiceDto,
      'seriesId' | 'customerId' | 'warehouseId' | 'paymentMethodId' | 'docDate' | 'dueDate' | 'lines'
    >,
    tx: Prisma.TransactionClient,
  ) {
    this.validateDueDate(dto.docDate, dto.dueDate);

    const [series, customer, warehouse, paymentMethod] = await Promise.all([
      tx.documentSeries.findUnique({ where: { id: dto.seriesId } }),
      tx.customer.findUnique({ where: { id: dto.customerId } }),
      tx.warehouse.findUnique({ where: { id: dto.warehouseId } }),
      dto.paymentMethodId
        ? tx.paymentMethod.findUnique({ where: { id: dto.paymentMethodId } })
        : Promise.resolve(null),
    ]);

    if (!series || series.documentType !== 'SALES_INVOICE' || !series.isActive) {
      throw new BadRequestException('Sales invoice series not found or inactive');
    }

    if (!customer || !customer.isActive) {
      throw new BadRequestException('Customer not found or inactive');
    }

    if (!warehouse || !warehouse.isActive) {
      throw new BadRequestException('Warehouse not found or inactive');
    }

    if (dto.paymentMethodId && (!paymentMethod || !paymentMethod.isActive)) {
      throw new BadRequestException('Payment method not found or inactive');
    }

    const uniqueItemIds = [...new Set(dto.lines.map((line) => line.itemId))];
    const items = await tx.item.findMany({
      where: { id: { in: uniqueItemIds } },
      select: { id: true, isActive: true },
    });

    if (items.length !== uniqueItemIds.length) {
      throw new BadRequestException('One or more sales invoice items were not found');
    }

    if (items.some((item) => !item.isActive)) {
      throw new BadRequestException('Sales invoice contains inactive items');
    }
  }

  private toDraftLineInput(existing: Awaited<ReturnType<SalesInvoicesService['findOne']>>) {
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

  async create(dto: CreateSalesInvoiceDto, userId: string) {
    const calc = this.calculateLines(dto.lines);

    const doc = await this.prisma.$transaction(async (tx) => {
      await this.validateDraftInput(dto, tx);

      const series = await tx.documentSeries.findUnique({ where: { id: dto.seriesId } });
      if (!series) throw new BadRequestException('Series not found');

      const docNo = buildDocNo(series.prefix, series.nextNumber);

      const created = await tx.salesInvoice.create({
        data: {
          seriesId: dto.seriesId,
          customerId: dto.customerId,
          warehouseId: dto.warehouseId,
          paymentMethodId: dto.paymentMethodId,
          docNo,
          docDate: new Date(dto.docDate),
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          status: DocumentStatus.DRAFT,
          subtotal: calc.subtotal,
          discountTotal: calc.discountTotal,
          taxTotal: calc.taxTotal,
          grandTotal: calc.grandTotal,
          notes: dto.notes,
          createdById: userId,
          lines: { create: calc.lines },
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
      entityType: 'sales_invoices',
      entityId: doc.id,
      action: 'CREATE_DRAFT',
      metadata: { docNo: doc.docNo },
    });

    return doc;
  }

  async update(id: string, dto: UpdateSalesInvoiceDto) {
    const existing = await this.findOne(id);
    if (existing.status !== DocumentStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT sales invoice can be updated');
    }

    if (dto.seriesId && dto.seriesId !== existing.seriesId) {
      throw new BadRequestException('Series cannot be changed after draft creation');
    }

    return this.prisma.$transaction(async (tx) => {
      let calc: ReturnType<SalesInvoicesService['calculateLines']> | null = null;
      const draftInput = {
        seriesId: existing.seriesId,
        customerId: dto.customerId ?? existing.customerId,
        warehouseId: dto.warehouseId ?? existing.warehouseId,
        paymentMethodId:
          dto.paymentMethodId === undefined ? existing.paymentMethodId ?? undefined : dto.paymentMethodId,
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
        await tx.salesInvoiceLine.deleteMany({ where: { salesInvoiceId: id } });
      }

      const updated = await tx.salesInvoice.update({
        where: { id },
        data: {
          customerId: dto.customerId,
          warehouseId: dto.warehouseId,
          paymentMethodId: dto.paymentMethodId,
          docDate: dto.docDate ? new Date(dto.docDate) : undefined,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          notes: dto.notes,
          subtotal: calc?.subtotal,
          discountTotal: calc?.discountTotal,
          taxTotal: calc?.taxTotal,
          grandTotal: calc?.grandTotal,
          lines: calc ? { create: calc.lines } : undefined,
        },
        include: { lines: true },
      });

      await this.auditLogs.log({
        entityType: 'sales_invoices',
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
      throw new BadRequestException('Only DRAFT sales invoice can be posted');
    }

    for (const line of existing.lines) {
      await this.stockService.ensureSufficientStock({
        warehouseId: existing.warehouseId,
        itemId: line.itemId,
        requestedQty: Number(line.qty),
      });
    }

    const doc = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.salesInvoice.update({
        where: { id },
        data: {
          status: DocumentStatus.POSTED,
          postedById,
          postedAt: new Date(),
        },
        include: { lines: true },
      });

      for (const line of updated.lines) {
        const balance = await tx.stockBalance.findUnique({
          where: {
            warehouseId_itemId: {
              warehouseId: updated.warehouseId,
              itemId: line.itemId,
            },
          },
        });

        await this.stockService.applyMovement(tx, {
          warehouseId: updated.warehouseId,
          itemId: line.itemId,
          movementType: MovementType.SALE_OUT,
          qtyOut: Number(line.qty),
          unitCost: Number(balance?.avgCost ?? 0),
          salesInvoiceId: updated.id,
          referenceNo: updated.docNo,
          movementAt: new Date(),
        });
      }

      return updated;
    });

    await this.auditLogs.log({
      userId: postedById,
      entityType: 'sales_invoices',
      entityId: doc.id,
      action: 'POST',
      metadata: { docNo: doc.docNo },
    });

    return doc;
  }

  async recordPayment(id: string, dto: RecordPaymentDto, userId: string) {
    const existing = await this.findOne(id);
    if (existing.status === DocumentStatus.DRAFT) {
      throw new BadRequestException('Only posted sales invoices can receive payments');
    }

    const total = Number(existing.settlementTotal ?? existing.grandTotal);
    const currentPaid = Number(existing.amountPaid ?? 0);
    const outstandingBefore = calculateOutstandingAmount(total, currentPaid);
    const paymentStatusBefore = resolvePaymentStatus(total, currentPaid);

    if (outstandingBefore <= 0) {
      throw new BadRequestException('Sales invoice is already fully settled');
    }

    const allocation = calculatePaymentAllocation(Number(dto.amount), outstandingBefore);

    if (allocation.unappliedAmount > 0 && !dto.allowUnapplied) {
      throw new BadRequestException(
        'Payment exceeds the remaining receivable amount. Enable unapplied handling to keep the excess as advance.',
      );
    }

    const nextPaid = round2(currentPaid + allocation.appliedAmount);
    const outstandingAfter = calculateOutstandingAmount(total, nextPaid);
    const paymentStatusAfter = resolvePaymentStatus(total, nextPaid);

    if (nextPaid > total) {
      throw new BadRequestException('Payment exceeds the remaining receivable amount');
    }

    const updated = await this.prisma.salesInvoice.update({
      where: { id },
      data: {
        amountPaid: nextPaid,
        paymentStatus: paymentStatusAfter,
      },
    });

    await this.auditLogs.log({
      userId,
      entityType: 'sales_invoices',
      entityId: updated.id,
      action: 'RECORD_PAYMENT',
      metadata: {
        amount: allocation.appliedAmount,
        enteredAmount: allocation.enteredAmount,
        appliedAmount: allocation.appliedAmount,
        unappliedAmount: allocation.unappliedAmount,
        allowUnapplied: dto.allowUnapplied === true,
        paidAt: dto.paidAt ?? new Date().toISOString(),
        referenceNo: dto.referenceNo,
        notes: dto.notes,
        settlementTotal: total,
        amountPaidBefore: currentPaid,
        amountPaidAfter: nextPaid,
        outstandingBefore,
        outstandingAfter,
        remainingAmount: outstandingAfter,
        paymentStatusBefore,
        paymentStatusAfter,
      },
    });

    return this.enrichDocumentState(updated);
  }
}
