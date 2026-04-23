import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentStatus, MovementType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { StockService } from '../stock/stock.service';
import { buildDocNo } from '../common/utils/series';
import { round2 } from '../common/utils/money';
import { CreateSalesReturnDto } from './dto/create-sales-return.dto';
import { UpdateSalesReturnDto } from './dto/update-sales-return.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { toPaginatedResponse, toPagination } from '../common/utils/pagination';
import { resolvePaymentStatus } from '../common/utils/payments';
import { FinancialPeriodsService } from '../financial-periods/financial-periods.service';

@Injectable()
export class SalesReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
    private readonly stockService: StockService,
    private readonly financialPeriodsService: FinancialPeriodsService,
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
            { salesInvoice: { docNo: { contains: search, mode: 'insensitive' as const } } },
            { reason: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : undefined;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.salesReturn.findMany({
        where,
        include: {
          customer: true,
          salesInvoice: true,
          series: true,
          createdBy: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.salesReturn.count({ where }),
    ]);

    return toPaginatedResponse({ items, total, page, limit });
  }

  async findOne(id: string) {
    const doc = await this.prisma.salesReturn.findUnique({
      where: { id },
      include: {
        customer: true,
        salesInvoice: {
          include: {
            customer: true,
            paymentMethod: true,
          },
        },
        lines: {
          include: {
            item: true,
            salesInvoiceLine: {
              include: {
                item: true,
              },
            },
          },
        },
        series: true,
        createdBy: true,
        postedBy: true,
      },
    });
    if (!doc) throw new NotFoundException('Sales return not found');
    return doc;
  }

  private calculateLines(lines: CreateSalesReturnDto['lines']) {
    const mapped = lines.map((line, index) => {
      const netAmount = round2(Number(line.qty) * Number(line.unitPrice));
      const taxAmount = round2(netAmount * (Number(line.taxPercent) / 100));
      const grossAmount = round2(netAmount + taxAmount);

      return {
        lineNo: index + 1,
        salesInvoiceLineId: line.salesInvoiceLineId,
        itemId: line.itemId,
        qty: Number(line.qty),
        unitPrice: Number(line.unitPrice),
        taxPercent: Number(line.taxPercent),
        netAmount,
        taxAmount,
        grossAmount,
      };
    });

    const subtotal = round2(mapped.reduce((a, b) => a + Number(b.netAmount), 0));
    const taxTotal = round2(mapped.reduce((a, b) => a + Number(b.taxAmount), 0));
    const grandTotal = round2(mapped.reduce((a, b) => a + Number(b.grossAmount), 0));

    return { lines: mapped, subtotal, taxTotal, grandTotal };
  }

  private async validateDraftInput(
    dto: Pick<CreateSalesReturnDto, 'seriesId' | 'salesInvoiceId' | 'customerId' | 'lines'>,
    tx: Prisma.TransactionClient,
    excludeReturnId?: string,
  ) {
    const [series, customer, salesInvoice] = await Promise.all([
      tx.documentSeries.findUnique({ where: { id: dto.seriesId } }),
      tx.customer.findUnique({ where: { id: dto.customerId } }),
      tx.salesInvoice.findUnique({
        where: { id: dto.salesInvoiceId },
        select: {
          id: true,
          customerId: true,
          status: true,
          warehouseId: true,
          docNo: true,
          grandTotal: true,
          amountPaid: true,
        },
      }),
    ]);

    if (!series || series.documentType !== 'SALES_RETURN' || !series.isActive) {
      throw new BadRequestException('Sales return series not found or inactive');
    }

    if (!customer || !customer.isActive) {
      throw new BadRequestException('Customer not found or inactive');
    }

    if (!salesInvoice) {
      throw new BadRequestException('Sales invoice not found');
    }

    if (
      salesInvoice.status !== DocumentStatus.POSTED &&
      salesInvoice.status !== DocumentStatus.PARTIALLY_RETURNED
    ) {
      throw new BadRequestException('Returns can be created only for posted sales invoices');
    }

    if (salesInvoice.customerId !== dto.customerId) {
      throw new BadRequestException('Return customer must match the source sales invoice');
    }

    const requestedBySourceLine = new Map<string, number>();

    for (const line of dto.lines ?? []) {
      requestedBySourceLine.set(
        line.salesInvoiceLineId,
        round2((requestedBySourceLine.get(line.salesInvoiceLineId) ?? 0) + Number(line.qty)),
      );
    }

    const sourceLineIds = [...requestedBySourceLine.keys()];
    const sourceLines = await tx.salesInvoiceLine.findMany({
      where: { id: { in: sourceLineIds } },
      select: {
        id: true,
        salesInvoiceId: true,
        itemId: true,
        qty: true,
        unitPrice: true,
        taxPercent: true,
      },
    });
    const sourceLineMap = new Map(sourceLines.map((line) => [line.id, line]));

    if (sourceLines.length !== sourceLineIds.length) {
      throw new BadRequestException('Referenced sales invoice line not found');
    }

    for (const line of dto.lines ?? []) {
      const invoiceLine = sourceLineMap.get(line.salesInvoiceLineId);

      if (!invoiceLine) {
        throw new BadRequestException('Referenced sales invoice line not found');
      }

      if (invoiceLine.salesInvoiceId !== dto.salesInvoiceId) {
        throw new BadRequestException('Return line does not belong to the selected sales invoice');
      }

      if (line.itemId && line.itemId !== invoiceLine.itemId) {
        throw new BadRequestException('Return line item must match the source sales invoice line');
      }
    }

    for (const [salesInvoiceLineId, requestedQty] of requestedBySourceLine.entries()) {
      const invoiceLine = sourceLineMap.get(salesInvoiceLineId);
      if (!invoiceLine) continue;

      const returnedAgg = await tx.salesReturnLine.aggregate({
        where: {
          salesInvoiceLineId,
          salesReturn: {
            status: DocumentStatus.POSTED,
            ...(excludeReturnId ? { id: { not: excludeReturnId } } : {}),
          },
        },
        _sum: { qty: true },
      });

      const alreadyReturned = Number(returnedAgg._sum.qty ?? 0);
      const soldQty = Number(invoiceLine.qty);

      if (alreadyReturned + requestedQty > soldQty) {
        throw new BadRequestException('Return quantity exceeds invoiced quantity');
      }
    }

    return {
      salesInvoice,
      lines: (dto.lines ?? []).map((line) => {
        const sourceLine = sourceLineMap.get(line.salesInvoiceLineId);
        if (!sourceLine) {
          throw new BadRequestException('Referenced sales invoice line not found');
        }

        return {
          salesInvoiceLineId: sourceLine.id,
          itemId: sourceLine.itemId,
          qty: Number(line.qty),
          unitPrice: Number(sourceLine.unitPrice),
          taxPercent: Number(sourceLine.taxPercent),
        };
      }),
    };
  }

  private toDraftLineInput(existing: Awaited<ReturnType<SalesReturnsService['findOne']>>) {
    return existing.lines.map((line) => ({
      salesInvoiceLineId: line.salesInvoiceLineId,
      itemId: line.itemId,
      qty: Number(line.qty),
      unitPrice: Number(line.unitPrice),
      taxPercent: Number(line.taxPercent),
    }));
  }

  async create(dto: CreateSalesReturnDto, userId: string) {
    await this.financialPeriodsService.assertDateOpen(
      dto.docDate,
      userId,
      'Krijimi i kthimit te shitjes',
    );
    const doc = await this.prisma.$transaction(async (tx) => {
      const validated = await this.validateDraftInput(dto, tx);
      const calc = this.calculateLines(validated.lines);
      const series = await tx.documentSeries.findUnique({ where: { id: dto.seriesId } });
      if (!series) throw new BadRequestException('Series not found');

      const docNo = buildDocNo(series.prefix, series.nextNumber);

      const created = await tx.salesReturn.create({
        data: {
          seriesId: dto.seriesId,
          salesInvoiceId: dto.salesInvoiceId,
          customerId: dto.customerId,
          docNo,
          docDate: new Date(dto.docDate),
          reason: dto.reason,
          status: DocumentStatus.DRAFT,
          subtotal: calc.subtotal,
          taxTotal: calc.taxTotal,
          grandTotal: calc.grandTotal,
          notes: dto.notes,
          createdById: userId,
          lines: { create: calc.lines },
        },
        include: {
          customer: true,
          salesInvoice: true,
          lines: {
            include: {
              item: true,
              salesInvoiceLine: true,
            },
          },
          series: true,
        },
      });

      await tx.documentSeries.update({
        where: { id: dto.seriesId },
        data: { nextNumber: { increment: 1 } },
      });

      return created;
    });

    await this.auditLogs.log({
      userId,
      entityType: 'sales_returns',
      entityId: doc.id,
      action: 'CREATE_DRAFT',
      metadata: { docNo: doc.docNo },
    });

    return doc;
  }

  async update(id: string, dto: UpdateSalesReturnDto, userId: string) {
    const existing = await this.findOne(id);
    if (existing.status !== DocumentStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT sales return can be updated');
    }

    if (dto.seriesId && dto.seriesId !== existing.seriesId) {
      throw new BadRequestException('Series cannot be changed after draft creation');
    }

    return this.prisma.$transaction(async (tx) => {
      let calc: ReturnType<SalesReturnsService['calculateLines']> | null = null;
      const draftInput = {
        seriesId: existing.seriesId,
        salesInvoiceId: dto.salesInvoiceId ?? existing.salesInvoiceId,
        customerId: dto.customerId ?? existing.customerId,
        lines: dto.lines ?? this.toDraftLineInput(existing),
      };

      await this.financialPeriodsService.assertDateOpen(
        dto.docDate ?? existing.docDate,
        userId,
        'Ndryshimi i kthimit te shitjes',
        tx,
      );

      const validated = await this.validateDraftInput(draftInput, tx, id);

      if (dto.lines?.length) {
        calc = this.calculateLines(validated.lines);
        await tx.salesReturnLine.deleteMany({ where: { salesReturnId: id } });
      }

      const updated = await tx.salesReturn.update({
        where: { id },
        data: {
          salesInvoiceId: dto.salesInvoiceId,
          customerId: dto.customerId,
          docDate: dto.docDate ? new Date(dto.docDate) : undefined,
          reason: dto.reason,
          notes: dto.notes,
          subtotal: calc?.subtotal,
          taxTotal: calc?.taxTotal,
          grandTotal: calc?.grandTotal,
          lines: calc ? { create: calc.lines } : undefined,
        },
        include: {
          customer: true,
          salesInvoice: true,
          lines: {
            include: {
              item: true,
              salesInvoiceLine: true,
            },
          },
          series: true,
        },
      });

      await this.auditLogs.log({
        entityType: 'sales_returns',
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
      throw new BadRequestException('Only DRAFT sales return can be posted');
    }

    await this.financialPeriodsService.assertDateOpen(
      existing.docDate,
      postedById,
      'Postimi i kthimit te shitjes',
    );

    const doc = await this.prisma.$transaction(async (tx) => {
      const validated = await this.validateDraftInput(
        {
          seriesId: existing.seriesId,
          salesInvoiceId: existing.salesInvoiceId,
          customerId: existing.customerId,
          lines: this.toDraftLineInput(existing),
        },
        tx,
        id,
      );
      const salesInvoice = validated.salesInvoice;

      const updated = await tx.salesReturn.update({
        where: { id },
        data: {
          status: DocumentStatus.POSTED,
          postedById,
          postedAt: new Date(),
        },
        include: {
          customer: true,
          salesInvoice: true,
          lines: {
            include: {
              item: true,
              salesInvoiceLine: true,
            },
          },
          series: true,
        },
      });

      for (const line of updated.lines) {
        const balance = await tx.stockBalance.findUnique({
          where: {
            warehouseId_itemId: {
              warehouseId: salesInvoice.warehouseId,
              itemId: line.itemId,
            },
          },
        });

        await this.stockService.applyMovement(tx, {
          warehouseId: salesInvoice.warehouseId,
          itemId: line.itemId,
          movementType: MovementType.SALES_RETURN_IN,
          qtyIn: Number(line.qty),
          unitCost: Number(balance?.avgCost ?? 0),
          salesReturnId: updated.id,
          referenceNo: updated.docNo,
          movementAt: new Date(),
        });
      }

      const invoiceLines = await tx.salesInvoiceLine.findMany({
        where: { salesInvoiceId: salesInvoice.id },
      });

      let isAnyReturned = false;
      let isFullyReturned = true;

      for (const line of invoiceLines) {
        const returnedAgg = await tx.salesReturnLine.aggregate({
          where: {
            salesInvoiceLineId: line.id,
            salesReturn: { status: DocumentStatus.POSTED },
          },
          _sum: { qty: true },
        });

        const returnedQty = Number(returnedAgg._sum.qty ?? 0);
        const soldQty = Number(line.qty);

        if (returnedQty > 0) isAnyReturned = true;
        if (returnedQty < soldQty) isFullyReturned = false;
      }

      if (isAnyReturned) {
        const returnsAgg = await tx.salesReturn.aggregate({
          where: {
            salesInvoiceId: salesInvoice.id,
            status: DocumentStatus.POSTED,
          },
          _sum: { grandTotal: true },
        });
        const creditedTotal = Number(returnsAgg._sum.grandTotal ?? 0);
        const settlementTotal = Math.max(0, Number(salesInvoice.grandTotal ?? 0) - creditedTotal);

        await tx.salesInvoice.update({
          where: { id: salesInvoice.id },
          data: {
            status: isFullyReturned ? DocumentStatus.FULLY_RETURNED : DocumentStatus.PARTIALLY_RETURNED,
            paymentStatus: resolvePaymentStatus(settlementTotal, Number(salesInvoice.amountPaid ?? 0)),
          },
        });
      }

      return updated;
    });

    await this.auditLogs.log({
      userId: postedById,
      entityType: 'sales_returns',
      entityId: doc.id,
      action: 'POST',
      metadata: { docNo: doc.docNo },
    });

    return doc;
  }
}
