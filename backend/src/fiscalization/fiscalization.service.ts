import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentStatus, FiscalStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { KosovoFiscalizationAdapter } from './kosovo-fiscalization.adapter';

@Injectable()
export class FiscalizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
    private readonly adapter: KosovoFiscalizationAdapter,
  ) {}

  async submitSalesInvoice(id: string, userId: string) {
    const invoice = await this.prisma.salesInvoice.findUnique({
      where: { id },
      include: {
        customer: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Sales invoice not found');
    }

    if (invoice.status === DocumentStatus.DRAFT) {
      throw new BadRequestException('Only posted sales invoices can be fiscalized');
    }

    if (invoice.fiscalStatus === FiscalStatus.ACCEPTED) {
      throw new BadRequestException('Sales invoice is already fiscalized');
    }

    const company = await this.prisma.companyProfile.findFirst();
    if (!company) {
      throw new BadRequestException('Company profile must be configured before fiscalization');
    }

    await this.prisma.salesInvoice.update({
      where: { id },
      data: {
        fiscalStatus: FiscalStatus.PENDING,
        fiscalError: null,
      },
    });

    try {
      const result = await this.adapter.submit(company.fiscalMode, {
        documentId: invoice.id,
        documentType: 'SALES_INVOICE',
        documentNumber: invoice.docNo,
        documentDate: invoice.docDate,
        totalAmount: Number(invoice.grandTotal),
        customerName: invoice.customer?.name,
        companyName: company.name,
      });

      const updated = await this.prisma.salesInvoice.update({
        where: { id },
        data: {
          fiscalStatus: FiscalStatus.ACCEPTED,
          fiscalReference: result.reference,
          fiscalizedAt: new Date(result.submittedAt),
          fiscalError: null,
        },
      });

      await this.auditLogs.log({
        userId,
        entityType: 'sales_invoices',
        entityId: updated.id,
        action: 'FISCALIZE_SUBMIT',
        metadata: {
          mode: result.mode,
          reference: result.reference,
        },
      });

      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Fiscalization failed';
      const updated = await this.prisma.salesInvoice.update({
        where: { id },
        data: {
          fiscalStatus: FiscalStatus.FAILED,
          fiscalError: message,
        },
      });

      await this.auditLogs.log({
        userId,
        entityType: 'sales_invoices',
        entityId: updated.id,
        action: 'FISCALIZE_FAILED',
        metadata: {
          error: message,
        },
      });

      throw error;
    }
  }

  async submitSalesReturn(id: string, userId: string) {
    const salesReturn = await this.prisma.salesReturn.findUnique({
      where: { id },
      include: {
        customer: true,
      },
    });

    if (!salesReturn) {
      throw new NotFoundException('Sales return not found');
    }

    if (salesReturn.status === DocumentStatus.DRAFT) {
      throw new BadRequestException('Only posted sales returns can be fiscalized');
    }

    if (salesReturn.fiscalStatus === FiscalStatus.ACCEPTED) {
      throw new BadRequestException('Sales return is already fiscalized');
    }

    const company = await this.prisma.companyProfile.findFirst();
    if (!company) {
      throw new BadRequestException('Company profile must be configured before fiscalization');
    }

    await this.prisma.salesReturn.update({
      where: { id },
      data: {
        fiscalStatus: FiscalStatus.PENDING,
        fiscalError: null,
      },
    });

    try {
      const result = await this.adapter.submit(company.fiscalMode, {
        documentId: salesReturn.id,
        documentType: 'SALES_RETURN',
        documentNumber: salesReturn.docNo,
        documentDate: salesReturn.docDate,
        totalAmount: Number(salesReturn.grandTotal),
        customerName: salesReturn.customer?.name,
        companyName: company.name,
      });

      const updated = await this.prisma.salesReturn.update({
        where: { id },
        data: {
          fiscalStatus: FiscalStatus.ACCEPTED,
          fiscalReference: result.reference,
          fiscalizedAt: new Date(result.submittedAt),
          fiscalError: null,
        },
      });

      await this.auditLogs.log({
        userId,
        entityType: 'sales_returns',
        entityId: updated.id,
        action: 'FISCALIZE_SUBMIT',
        metadata: {
          mode: result.mode,
          reference: result.reference,
        },
      });

      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Fiscalization failed';
      const updated = await this.prisma.salesReturn.update({
        where: { id },
        data: {
          fiscalStatus: FiscalStatus.FAILED,
          fiscalError: message,
        },
      });

      await this.auditLogs.log({
        userId,
        entityType: 'sales_returns',
        entityId: updated.id,
        action: 'FISCALIZE_FAILED',
        metadata: {
          error: message,
        },
      });

      throw error;
    }
  }
}
