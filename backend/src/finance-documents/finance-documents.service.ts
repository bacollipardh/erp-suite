import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentStatus, FinanceSettlementType, Prisma } from '@prisma/client';
import { buildDocNo } from '../common/utils/series';
import { round2 } from '../common/utils/money';
import { calculateOutstandingAmount, resolvePaymentStatus } from '../common/utils/payments';
import {
  calculateFinanceSettlementRemainingAmount,
  resolveFinanceSettlementStatus,
} from '../common/utils/finance-settlements';
import { AccountingService } from '../accounting/accounting.service';
import { FinanceAccountsService } from '../finance-accounts/finance-accounts.service';
import { FinancialPeriodsService } from '../financial-periods/financial-periods.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerReceiptDto } from './dto/create-customer-receipt.dto';
import { CreateSupplierPaymentDto } from './dto/create-supplier-payment.dto';

type Tx = Prisma.TransactionClient;
type FinanceDocumentKind = 'CUSTOMER_RECEIPT' | 'SUPPLIER_PAYMENT';

function clean(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function toDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new BadRequestException('Invalid document date');
  return date;
}

function sumAmounts(rows?: { amount: number }[]) {
  return round2((rows ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0));
}

@Injectable()
export class FinanceDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financeAccountsService: FinanceAccountsService,
    private readonly financialPeriodsService: FinancialPeriodsService,
    private readonly accountingService: AccountingService,
  ) {}

  async findCustomerReceipts() {
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT cr.*, c.name AS customer_name, fa.code AS account_code, fa.name AS account_name
      FROM customer_receipts cr
      JOIN customers c ON c.id = cr.customer_id
      JOIN finance_accounts fa ON fa.id = cr.finance_account_id
      ORDER BY cr.created_at DESC
      LIMIT 200
    `;

    return { items: rows.map((row) => this.mapCustomerReceipt(row)), total: rows.length };
  }

  async findCustomerReceipt(id: string) {
    const row = await this.getCustomerReceiptOrThrow(id);
    const allocations = await this.prisma.$queryRaw<any[]>`
      SELECT cra.*, si.doc_no, si.doc_date, si.due_date, si.grand_total, si.amount_paid, si.payment_status
      FROM customer_receipt_allocations cra
      JOIN sales_invoices si ON si.id = cra.sales_invoice_id
      WHERE cra.customer_receipt_id = ${id}::uuid
      ORDER BY cra.created_at ASC
    `;

    return { ...this.mapCustomerReceipt(row), allocations: allocations.map((entry) => this.mapAllocation(entry)) };
  }

  async createCustomerReceipt(dto: CreateCustomerReceiptDto, userId: string) {
    const docDate = toDate(dto.docDate);
    await this.financialPeriodsService.assertDateOpen(docDate, userId, 'Krijimi i arketimit financiar');

    const allocations = dto.allocations ?? [];
    const appliedAmount = sumAmounts(allocations);
    const enteredAmount = round2(Number(dto.amount ?? appliedAmount));
    if (enteredAmount <= 0) throw new BadRequestException('Receipt amount must be greater than zero');
    if (appliedAmount > enteredAmount) throw new BadRequestException('Allocation total exceeds receipt amount');

    const createdId = await this.prisma.$transaction(async (tx) => {
      const series = await this.resolveSeriesTx(tx, 'CUSTOMER_RECEIPT', dto.seriesId);
      await this.assertCustomerTx(tx, dto.customerId);
      await this.assertFinanceAccountTx(tx, dto.financeAccountId);
      await this.validateSalesAllocationsTx(tx, dto.customerId, allocations);
      const docNo = buildDocNo(series.prefix, series.nextNumber);

      const rows = await tx.$queryRaw<any[]>`
        INSERT INTO customer_receipts (
          series_id, customer_id, finance_account_id, doc_no, doc_date, status,
          entered_amount, applied_amount, unapplied_amount, reference_no, notes, created_by
        ) VALUES (
          ${series.id}::uuid, ${dto.customerId}::uuid, ${dto.financeAccountId}::uuid, ${docNo}, ${docDate}, 'DRAFT'::document_status,
          ${enteredAmount}, ${appliedAmount}, ${round2(enteredAmount - appliedAmount)}, ${clean(dto.referenceNo)}, ${clean(dto.notes)}, ${userId}::uuid
        ) RETURNING id
      `;

      const id = rows[0].id;
      for (const allocation of allocations) {
        await tx.$executeRaw`
          INSERT INTO customer_receipt_allocations (customer_receipt_id, sales_invoice_id, amount)
          VALUES (${id}::uuid, ${allocation.salesInvoiceId}::uuid, ${round2(Number(allocation.amount))})
        `;
      }

      await tx.documentSeries.update({ where: { id: series.id }, data: { nextNumber: { increment: 1 } } });
      await tx.auditLog.create({
        data: {
          userId,
          entityType: 'customer_receipts',
          entityId: id,
          action: 'CREATE_DRAFT',
          metadata: { docNo, enteredAmount, appliedAmount, allocationCount: allocations.length } as Prisma.InputJsonValue,
        },
      });

      return id;
    });

    return this.findCustomerReceipt(createdId);
  }

  async postCustomerReceipt(id: string, userId: string) {
    const postedId = await this.prisma.$transaction(async (tx) => {
      const receipt = await this.getCustomerReceiptOrThrowTx(tx, id);
      if (receipt.status !== DocumentStatus.DRAFT) throw new BadRequestException('Only DRAFT receipts can be posted');
      const docDate = toDate(receipt.doc_date);
      await this.financialPeriodsService.assertDateOpen(docDate, userId, 'Postimi i arketimit financiar', tx);

      const allocations = await tx.$queryRaw<any[]>`
        SELECT * FROM customer_receipt_allocations WHERE customer_receipt_id = ${id}::uuid ORDER BY created_at ASC
      `;

      for (const allocation of allocations) {
        const invoice = await tx.salesInvoice.findUnique({
          where: { id: allocation.sales_invoice_id },
          include: { returns: { where: { status: DocumentStatus.POSTED }, select: { grandTotal: true } } },
        });
        if (!invoice) throw new NotFoundException('Sales invoice not found');
        if (invoice.customerId !== receipt.customer_id) throw new BadRequestException('Receipt allocation must belong to the same customer');
        if (invoice.status === DocumentStatus.DRAFT || invoice.status === DocumentStatus.CANCELLED || invoice.status === DocumentStatus.STORNO) {
          throw new BadRequestException('Sales invoice is not eligible for receipt allocation');
        }

        const creditedAmount = round2(invoice.returns.reduce((sum, row) => sum + Number(row.grandTotal ?? 0), 0));
        const settlementTotal = round2(Math.max(0, Number(invoice.grandTotal ?? 0) - creditedAmount));
        const beforePaid = round2(Number(invoice.amountPaid ?? 0));
        const outstandingBefore = calculateOutstandingAmount(settlementTotal, beforePaid);
        const amount = round2(Number(allocation.amount ?? 0));
        if (amount > outstandingBefore) throw new BadRequestException(`Receipt allocation exceeds outstanding amount for ${invoice.docNo}`);

        const afterPaid = round2(beforePaid + amount);
        const outstandingAfter = calculateOutstandingAmount(settlementTotal, afterPaid);
        const statusAfter = resolvePaymentStatus(settlementTotal, afterPaid);

        await tx.salesInvoice.update({ where: { id: invoice.id }, data: { amountPaid: afterPaid, paymentStatus: statusAfter } });
        await tx.$executeRaw`
          UPDATE customer_receipt_allocations
          SET amount_paid_before = ${beforePaid}, amount_paid_after = ${afterPaid}, outstanding_before = ${outstandingBefore}, outstanding_after = ${outstandingAfter}
          WHERE id = ${allocation.id}::uuid
        `;
        await tx.auditLog.create({
          data: {
            userId,
            entityType: 'sales_invoices',
            entityId: invoice.id,
            action: 'RECORD_PAYMENT',
            metadata: {
              sourceDocumentType: 'customer_receipts', sourceDocumentId: id, sourceDocumentNo: receipt.doc_no,
              amount, enteredAmount: Number(receipt.entered_amount), appliedAmount: amount, unappliedAmount: 0,
              paidAt: docDate.toISOString(), referenceNo: receipt.reference_no, notes: receipt.notes,
              settlementTotal, amountPaidBefore: beforePaid, amountPaidAfter: afterPaid,
              outstandingBefore, outstandingAfter, remainingAmount: outstandingAfter,
              paymentStatusBefore: resolvePaymentStatus(settlementTotal, beforePaid), paymentStatusAfter: statusAfter,
            } as Prisma.InputJsonValue,
          },
        });
      }

      const enteredAmount = round2(Number(receipt.entered_amount ?? 0));
      const appliedAmount = round2(Number(receipt.applied_amount ?? 0));
      const unappliedAmount = round2(Number(receipt.unapplied_amount ?? 0));
      let settlementId: string | undefined;

      if (unappliedAmount > 0) {
        const settlement = await tx.financeSettlement.create({
          data: {
            entryType: FinanceSettlementType.RECEIPT,
            status: resolveFinanceSettlementStatus(unappliedAmount, 0),
            customerId: receipt.customer_id,
            enteredAmount,
            sourceAppliedAmount: appliedAmount,
            unappliedAmount,
            allocatedAmount: 0,
            remainingAmount: calculateFinanceSettlementRemainingAmount(unappliedAmount, 0),
            paidAt: docDate,
            referenceNo: receipt.reference_no,
            notes: receipt.notes,
            createdById: userId,
          },
        });
        settlementId = settlement.id;
      }

      await this.financeAccountsService.recordReceiptTransactionTx(tx, {
        financeAccountId: receipt.finance_account_id,
        amount: enteredAmount,
        appliedAmount,
        unappliedAmount,
        transactionDate: docDate,
        createdById: userId,
        referenceNo: receipt.reference_no,
        notes: receipt.notes,
        counterpartyName: receipt.customer_name,
        sourceDocumentNo: receipt.doc_no,
        financeSettlementId: settlementId,
      });

      await tx.$executeRaw`
        UPDATE customer_receipts SET status = 'POSTED'::document_status, posted_by = ${userId}::uuid, posted_at = now(), updated_at = now()
        WHERE id = ${id}::uuid
      `;
      await tx.auditLog.create({
        data: {
          userId,
          entityType: 'customer_receipts',
          entityId: id,
          action: 'POST',
          metadata: { docNo: receipt.doc_no, enteredAmount, appliedAmount, unappliedAmount, settlementId } as Prisma.InputJsonValue,
        },
      });

      return id;
    });

    return this.findCustomerReceipt(postedId);
  }

  async findSupplierPayments() {
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT sp.*, s.name AS supplier_name, fa.code AS account_code, fa.name AS account_name
      FROM supplier_payments sp
      JOIN suppliers s ON s.id = sp.supplier_id
      JOIN finance_accounts fa ON fa.id = sp.finance_account_id
      ORDER BY sp.created_at DESC
      LIMIT 200
    `;

    return { items: rows.map((row) => this.mapSupplierPayment(row)), total: rows.length };
  }

  async findSupplierPayment(id: string) {
    const row = await this.getSupplierPaymentOrThrow(id);
    const allocations = await this.prisma.$queryRaw<any[]>`
      SELECT spa.*, pi.doc_no, pi.doc_date, pi.due_date, pi.grand_total, pi.amount_paid, pi.payment_status
      FROM supplier_payment_allocations spa
      JOIN purchase_invoices pi ON pi.id = spa.purchase_invoice_id
      WHERE spa.supplier_payment_id = ${id}::uuid
      ORDER BY spa.created_at ASC
    `;

    return { ...this.mapSupplierPayment(row), allocations: allocations.map((entry) => this.mapAllocation(entry)) };
  }

  async createSupplierPayment(dto: CreateSupplierPaymentDto, userId: string) {
    const docDate = toDate(dto.docDate);
    await this.financialPeriodsService.assertDateOpen(docDate, userId, 'Krijimi i pageses financiare');

    const allocations = dto.allocations ?? [];
    const appliedAmount = sumAmounts(allocations);
    const enteredAmount = round2(Number(dto.amount ?? appliedAmount));
    if (enteredAmount <= 0) throw new BadRequestException('Payment amount must be greater than zero');
    if (appliedAmount > enteredAmount) throw new BadRequestException('Allocation total exceeds payment amount');

    const createdId = await this.prisma.$transaction(async (tx) => {
      const series = await this.resolveSeriesTx(tx, 'SUPPLIER_PAYMENT', dto.seriesId);
      await this.assertSupplierTx(tx, dto.supplierId);
      await this.assertFinanceAccountTx(tx, dto.financeAccountId);
      await this.validatePurchaseAllocationsTx(tx, dto.supplierId, allocations);
      const docNo = buildDocNo(series.prefix, series.nextNumber);

      const rows = await tx.$queryRaw<any[]>`
        INSERT INTO supplier_payments (
          series_id, supplier_id, finance_account_id, doc_no, doc_date, status,
          entered_amount, applied_amount, unapplied_amount, reference_no, notes, created_by
        ) VALUES (
          ${series.id}::uuid, ${dto.supplierId}::uuid, ${dto.financeAccountId}::uuid, ${docNo}, ${docDate}, 'DRAFT'::document_status,
          ${enteredAmount}, ${appliedAmount}, ${round2(enteredAmount - appliedAmount)}, ${clean(dto.referenceNo)}, ${clean(dto.notes)}, ${userId}::uuid
        ) RETURNING id
      `;

      const id = rows[0].id;
      for (const allocation of allocations) {
        await tx.$executeRaw`
          INSERT INTO supplier_payment_allocations (supplier_payment_id, purchase_invoice_id, amount)
          VALUES (${id}::uuid, ${allocation.purchaseInvoiceId}::uuid, ${round2(Number(allocation.amount))})
        `;
      }

      await tx.documentSeries.update({ where: { id: series.id }, data: { nextNumber: { increment: 1 } } });
      await tx.auditLog.create({
        data: {
          userId,
          entityType: 'supplier_payments',
          entityId: id,
          action: 'CREATE_DRAFT',
          metadata: { docNo, enteredAmount, appliedAmount, allocationCount: allocations.length } as Prisma.InputJsonValue,
        },
      });

      return id;
    });

    return this.findSupplierPayment(createdId);
  }

  async postSupplierPayment(id: string, userId: string) {
    const postedId = await this.prisma.$transaction(async (tx) => {
      const payment = await this.getSupplierPaymentOrThrowTx(tx, id);
      if (payment.status !== DocumentStatus.DRAFT) throw new BadRequestException('Only DRAFT payments can be posted');
      const docDate = toDate(payment.doc_date);
      await this.financialPeriodsService.assertDateOpen(docDate, userId, 'Postimi i pageses financiare', tx);

      const allocations = await tx.$queryRaw<any[]>`
        SELECT * FROM supplier_payment_allocations WHERE supplier_payment_id = ${id}::uuid ORDER BY created_at ASC
      `;

      for (const allocation of allocations) {
        const invoice = await tx.purchaseInvoice.findUnique({ where: { id: allocation.purchase_invoice_id } });
        if (!invoice) throw new NotFoundException('Purchase invoice not found');
        if (invoice.supplierId !== payment.supplier_id) throw new BadRequestException('Payment allocation must belong to the same supplier');
        if (invoice.status === DocumentStatus.DRAFT || invoice.status === DocumentStatus.CANCELLED || invoice.status === DocumentStatus.STORNO) {
          throw new BadRequestException('Purchase invoice is not eligible for payment allocation');
        }

        const total = round2(Number(invoice.grandTotal ?? 0));
        const beforePaid = round2(Number(invoice.amountPaid ?? 0));
        const outstandingBefore = calculateOutstandingAmount(total, beforePaid);
        const amount = round2(Number(allocation.amount ?? 0));
        if (amount > outstandingBefore) throw new BadRequestException(`Payment allocation exceeds outstanding amount for ${invoice.docNo}`);

        const afterPaid = round2(beforePaid + amount);
        const outstandingAfter = calculateOutstandingAmount(total, afterPaid);
        const statusAfter = resolvePaymentStatus(total, afterPaid);

        await tx.purchaseInvoice.update({ where: { id: invoice.id }, data: { amountPaid: afterPaid, paymentStatus: statusAfter } });
        await tx.$executeRaw`
          UPDATE supplier_payment_allocations
          SET amount_paid_before = ${beforePaid}, amount_paid_after = ${afterPaid}, outstanding_before = ${outstandingBefore}, outstanding_after = ${outstandingAfter}
          WHERE id = ${allocation.id}::uuid
        `;
        await tx.auditLog.create({
          data: {
            userId,
            entityType: 'purchase_invoices',
            entityId: invoice.id,
            action: 'RECORD_PAYMENT',
            metadata: {
              sourceDocumentType: 'supplier_payments', sourceDocumentId: id, sourceDocumentNo: payment.doc_no,
              amount, enteredAmount: Number(payment.entered_amount), appliedAmount: amount, unappliedAmount: 0,
              paidAt: docDate.toISOString(), referenceNo: payment.reference_no, notes: payment.notes,
              settlementTotal: total, amountPaidBefore: beforePaid, amountPaidAfter: afterPaid,
              outstandingBefore, outstandingAfter, remainingAmount: outstandingAfter,
              paymentStatusBefore: resolvePaymentStatus(total, beforePaid), paymentStatusAfter: statusAfter,
            } as Prisma.InputJsonValue,
          },
        });
      }

      const enteredAmount = round2(Number(payment.entered_amount ?? 0));
      const appliedAmount = round2(Number(payment.applied_amount ?? 0));
      const unappliedAmount = round2(Number(payment.unapplied_amount ?? 0));
      let settlementId: string | undefined;

      if (unappliedAmount > 0) {
        const settlement = await tx.financeSettlement.create({
          data: {
            entryType: FinanceSettlementType.PAYMENT,
            status: resolveFinanceSettlementStatus(unappliedAmount, 0),
            supplierId: payment.supplier_id,
            enteredAmount,
            sourceAppliedAmount: appliedAmount,
            unappliedAmount,
            allocatedAmount: 0,
            remainingAmount: calculateFinanceSettlementRemainingAmount(unappliedAmount, 0),
            paidAt: docDate,
            referenceNo: payment.reference_no,
            notes: payment.notes,
            createdById: userId,
          },
        });
        settlementId = settlement.id;
      }

      await this.financeAccountsService.recordPaymentTransactionTx(tx, {
        financeAccountId: payment.finance_account_id,
        amount: enteredAmount,
        appliedAmount,
        unappliedAmount,
        transactionDate: docDate,
        createdById: userId,
        referenceNo: payment.reference_no,
        notes: payment.notes,
        counterpartyName: payment.supplier_name,
        sourceDocumentNo: payment.doc_no,
        financeSettlementId: settlementId,
      });

      await tx.$executeRaw`
        UPDATE supplier_payments SET status = 'POSTED'::document_status, posted_by = ${userId}::uuid, posted_at = now(), updated_at = now()
        WHERE id = ${id}::uuid
      `;
      await tx.auditLog.create({
        data: {
          userId,
          entityType: 'supplier_payments',
          entityId: id,
          action: 'POST',
          metadata: { docNo: payment.doc_no, enteredAmount, appliedAmount, unappliedAmount, settlementId } as Prisma.InputJsonValue,
        },
      });

      return id;
    });

    return this.findSupplierPayment(postedId);
  }

  private async resolveSeriesTx(tx: Tx, documentType: FinanceDocumentKind, seriesId?: string) {
    const where = seriesId ? { id: seriesId } : { documentType, isActive: true };
    const series = await tx.documentSeries.findFirst({ where, orderBy: { createdAt: 'asc' } });
    if (!series || series.documentType !== documentType || !series.isActive) {
      throw new BadRequestException(`${documentType} series not found or inactive`);
    }
    return series;
  }

  private async assertCustomerTx(tx: Tx, id: string) {
    const row = await tx.customer.findUnique({ where: { id } });
    if (!row || !row.isActive) throw new BadRequestException('Customer not found or inactive');
    return row;
  }

  private async assertSupplierTx(tx: Tx, id: string) {
    const row = await tx.supplier.findUnique({ where: { id } });
    if (!row || !row.isActive) throw new BadRequestException('Supplier not found or inactive');
    return row;
  }

  private async assertFinanceAccountTx(tx: Tx, id: string) {
    const row = await tx.financeAccount.findUnique({ where: { id } });
    if (!row || !row.isActive) throw new BadRequestException('Finance account not found or inactive');
    return row;
  }

  private async validateSalesAllocationsTx(tx: Tx, customerId: string, allocations: { salesInvoiceId: string; amount: number }[]) {
    const ids = new Set<string>();
    for (const allocation of allocations) {
      if (ids.has(allocation.salesInvoiceId)) throw new BadRequestException('Duplicate sales invoice allocation');
      ids.add(allocation.salesInvoiceId);
      const invoice = await tx.salesInvoice.findUnique({ where: { id: allocation.salesInvoiceId } });
      if (!invoice || invoice.customerId !== customerId) throw new BadRequestException('Invalid sales invoice allocation');
      if (invoice.status === DocumentStatus.DRAFT || invoice.status === DocumentStatus.CANCELLED || invoice.status === DocumentStatus.STORNO) {
        throw new BadRequestException('Sales invoice is not eligible for allocation');
      }
    }
  }

  private async validatePurchaseAllocationsTx(tx: Tx, supplierId: string, allocations: { purchaseInvoiceId: string; amount: number }[]) {
    const ids = new Set<string>();
    for (const allocation of allocations) {
      if (ids.has(allocation.purchaseInvoiceId)) throw new BadRequestException('Duplicate purchase invoice allocation');
      ids.add(allocation.purchaseInvoiceId);
      const invoice = await tx.purchaseInvoice.findUnique({ where: { id: allocation.purchaseInvoiceId } });
      if (!invoice || invoice.supplierId !== supplierId) throw new BadRequestException('Invalid purchase invoice allocation');
      if (invoice.status === DocumentStatus.DRAFT || invoice.status === DocumentStatus.CANCELLED || invoice.status === DocumentStatus.STORNO) {
        throw new BadRequestException('Purchase invoice is not eligible for allocation');
      }
    }
  }

  private async getCustomerReceiptOrThrow(id: string) {
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT cr.*, c.name AS customer_name, fa.code AS account_code, fa.name AS account_name
      FROM customer_receipts cr
      JOIN customers c ON c.id = cr.customer_id
      JOIN finance_accounts fa ON fa.id = cr.finance_account_id
      WHERE cr.id = ${id}::uuid
      LIMIT 1
    `;
    if (!rows[0]) throw new NotFoundException('Customer receipt not found');
    return rows[0];
  }

  private async getCustomerReceiptOrThrowTx(tx: Tx, id: string) {
    const rows = await tx.$queryRaw<any[]>`
      SELECT cr.*, c.name AS customer_name
      FROM customer_receipts cr
      JOIN customers c ON c.id = cr.customer_id
      WHERE cr.id = ${id}::uuid
      LIMIT 1
    `;
    if (!rows[0]) throw new NotFoundException('Customer receipt not found');
    return rows[0];
  }

  private async getSupplierPaymentOrThrow(id: string) {
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT sp.*, s.name AS supplier_name, fa.code AS account_code, fa.name AS account_name
      FROM supplier_payments sp
      JOIN suppliers s ON s.id = sp.supplier_id
      JOIN finance_accounts fa ON fa.id = sp.finance_account_id
      WHERE sp.id = ${id}::uuid
      LIMIT 1
    `;
    if (!rows[0]) throw new NotFoundException('Supplier payment not found');
    return rows[0];
  }

  private async getSupplierPaymentOrThrowTx(tx: Tx, id: string) {
    const rows = await tx.$queryRaw<any[]>`
      SELECT sp.*, s.name AS supplier_name
      FROM supplier_payments sp
      JOIN suppliers s ON s.id = sp.supplier_id
      WHERE sp.id = ${id}::uuid
      LIMIT 1
    `;
    if (!rows[0]) throw new NotFoundException('Supplier payment not found');
    return rows[0];
  }

  private mapCustomerReceipt(row: any) {
    return {
      id: row.id,
      docNo: row.doc_no,
      docDate: row.doc_date,
      status: row.status,
      enteredAmount: Number(row.entered_amount ?? 0),
      appliedAmount: Number(row.applied_amount ?? 0),
      unappliedAmount: Number(row.unapplied_amount ?? 0),
      referenceNo: row.reference_no ?? null,
      notes: row.notes ?? null,
      postedAt: row.posted_at ?? null,
      customer: { id: row.customer_id, name: row.customer_name },
      financeAccount: { id: row.finance_account_id, code: row.account_code, name: row.account_name },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapSupplierPayment(row: any) {
    return {
      id: row.id,
      docNo: row.doc_no,
      docDate: row.doc_date,
      status: row.status,
      enteredAmount: Number(row.entered_amount ?? 0),
      appliedAmount: Number(row.applied_amount ?? 0),
      unappliedAmount: Number(row.unapplied_amount ?? 0),
      referenceNo: row.reference_no ?? null,
      notes: row.notes ?? null,
      postedAt: row.posted_at ?? null,
      supplier: { id: row.supplier_id, name: row.supplier_name },
      financeAccount: { id: row.finance_account_id, code: row.account_code, name: row.account_name },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapAllocation(row: any) {
    return {
      id: row.id,
      amount: Number(row.amount ?? 0),
      amountPaidBefore: row.amount_paid_before === null ? null : Number(row.amount_paid_before ?? 0),
      amountPaidAfter: row.amount_paid_after === null ? null : Number(row.amount_paid_after ?? 0),
      outstandingBefore: row.outstanding_before === null ? null : Number(row.outstanding_before ?? 0),
      outstandingAfter: row.outstanding_after === null ? null : Number(row.outstanding_after ?? 0),
      document: {
        id: row.sales_invoice_id ?? row.purchase_invoice_id,
        docNo: row.doc_no,
        docDate: row.doc_date,
        dueDate: row.due_date,
        grandTotal: Number(row.grand_total ?? 0),
        amountPaid: Number(row.amount_paid ?? 0),
        paymentStatus: row.payment_status,
      },
    };
  }
}
