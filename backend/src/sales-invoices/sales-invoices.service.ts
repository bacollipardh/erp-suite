import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentStatus, MovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { buildDocNo } from '../common/utils/series';
import { round2 } from '../common/utils/money';
import { CreateSalesInvoiceDto } from './dto/create-sales-invoice.dto';
import { UpdateSalesInvoiceDto } from './dto/update-sales-invoice.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { toPaginatedResponse, toPagination } from '../common/utils/pagination';
import { resolvePaymentStatus } from '../common/utils/payments';
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
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.salesInvoice.count({ where }),
    ]);

    return toPaginatedResponse({ items, total, page, limit });
  }

  async findOne(id: string) {
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
      },
    });
    if (!doc) throw new NotFoundException('Sales invoice not found');
    return doc;
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

  async create(dto: CreateSalesInvoiceDto, userId: string) {
    const calc = this.calculateLines(dto.lines);

    const doc = await this.prisma.$transaction(async (tx) => {
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

    return this.prisma.$transaction(async (tx) => {
      let calc: ReturnType<SalesInvoicesService['calculateLines']> | null = null;

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

    const total = Number(existing.grandTotal);
    const currentPaid = Number(existing.amountPaid ?? 0);
    const nextPaid = round2(currentPaid + Number(dto.amount));

    if (nextPaid > total) {
      throw new BadRequestException('Payment exceeds the remaining receivable amount');
    }

    const updated = await this.prisma.salesInvoice.update({
      where: { id },
      data: {
        amountPaid: nextPaid,
        paymentStatus: resolvePaymentStatus(total, nextPaid),
      },
    });

    await this.auditLogs.log({
      userId,
      entityType: 'sales_invoices',
      entityId: updated.id,
      action: 'RECORD_PAYMENT',
      metadata: {
        amount: dto.amount,
        paidAt: dto.paidAt ?? new Date().toISOString(),
        referenceNo: dto.referenceNo,
        notes: dto.notes,
      },
    });

    return updated;
  }
}
