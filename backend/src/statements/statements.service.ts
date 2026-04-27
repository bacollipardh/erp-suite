import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { round2 } from '../common/utils/money';

type StatementQuery = {
  customerId?: string;
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: string | number;
};

type StatementLine = {
  sourceType: string;
  sourceId: string;
  sourceNo: string;
  docDate: Date;
  createdAt: Date;
  description: string;
  referenceNo: string | null;
  partyId: string;
  partyName: string;
  debit: number;
  credit: number;
  balance: number;
};

type RawLine = Omit<StatementLine, 'balance'>;

type LedgerRawLine = RawLine & {
  dueDate: Date | null;
  outstanding: number;
  paymentStatus: string | null;
};

type LedgerLine = LedgerRawLine & { balance: number };

type AgingBuckets = {
  current: number;
  days1To30: number;
  days31To60: number;
  days61To90: number;
  days90Plus: number;
  overdueAmount: number;
};

function safeLimit(value?: string | number) {
  const parsed = Number(value ?? 500);
  if (!Number.isFinite(parsed)) return 500;
  return Math.min(Math.max(Math.trunc(parsed), 1), 2000);
}

function safeDate(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new BadRequestException('Invalid date filter');
  return value.slice(0, 10);
}

function normalizeRows(rows: any[]): RawLine[] {
  return rows.map((row) => ({
    sourceType: row.source_type,
    sourceId: row.source_id,
    sourceNo: row.source_no,
    docDate: row.doc_date,
    createdAt: row.created_at,
    description: row.description,
    referenceNo: row.reference_no ?? null,
    partyId: row.party_id,
    partyName: row.party_name,
    debit: Number(row.debit ?? 0),
    credit: Number(row.credit ?? 0),
  }));
}

function normalizeLedgerRows(rows: any[]): LedgerRawLine[] {
  return rows.map((row) => ({
    sourceType: row.source_type,
    sourceId: row.source_id,
    sourceNo: row.source_no,
    docDate: row.doc_date,
    dueDate: row.due_date ?? null,
    createdAt: row.created_at,
    description: row.description,
    referenceNo: row.reference_no ?? null,
    partyId: row.party_id,
    partyName: row.party_name,
    debit: Number(row.debit ?? 0),
    credit: Number(row.credit ?? 0),
    outstanding: Number(row.outstanding ?? 0),
    paymentStatus: row.payment_status ?? null,
  }));
}

function withRunningBalance(rows: RawLine[], openingBalance: number, mode: 'customer' | 'supplier') {
  let running = round2(openingBalance);
  const lines: StatementLine[] = rows.map((row) => {
    running = mode === 'customer'
      ? round2(running + row.debit - row.credit)
      : round2(running + row.credit - row.debit);
    return { ...row, balance: running };
  });
  return { lines, closingBalance: running };
}

function withLedgerRunningBalance(rows: LedgerRawLine[], openingBalance: number, mode: 'customer' | 'supplier') {
  let running = round2(openingBalance);
  const lines: LedgerLine[] = rows.map((row) => {
    running = mode === 'customer'
      ? round2(running + row.debit - row.credit)
      : round2(running + row.credit - row.debit);
    return { ...row, balance: running };
  });
  return { lines, closingBalance: running };
}

function calculateAgingBuckets(rows: LedgerRawLine[], today: string): AgingBuckets {
  const todayMs = new Date(today).getTime();
  let current = 0, days1To30 = 0, days31To60 = 0, days61To90 = 0, days90Plus = 0;

  for (const row of rows) {
    if (row.outstanding <= 0) continue;
    const dueDate = row.dueDate ?? row.docDate;
    const daysPastDue = Math.floor((todayMs - new Date(dueDate).getTime()) / 86400000);

    if (daysPastDue <= 0) current += row.outstanding;
    else if (daysPastDue <= 30) days1To30 += row.outstanding;
    else if (daysPastDue <= 60) days31To60 += row.outstanding;
    else if (daysPastDue <= 90) days61To90 += row.outstanding;
    else days90Plus += row.outstanding;
  }

  const overdueAmount = round2(days1To30 + days31To60 + days61To90 + days90Plus);
  return {
    current: round2(current),
    days1To30: round2(days1To30),
    days31To60: round2(days31To60),
    days61To90: round2(days61To90),
    days90Plus: round2(days90Plus),
    overdueAmount,
  };
}

@Injectable()
export class StatementsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCustomerStatement(query: StatementQuery = {}) {
    const dateFrom = safeDate(query.dateFrom);
    const dateTo = safeDate(query.dateTo);
    const limit = safeLimit(query.limit);
    const customerId = query.customerId?.trim() || null;

    const rows = normalizeRows(await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT * FROM (
        SELECT
          'sales-invoices'::text AS source_type,
          si.id::text AS source_id,
          si.doc_no AS source_no,
          si.doc_date AS doc_date,
          si.created_at AS created_at,
          'Sales Invoice'::text AS description,
          NULL::text AS reference_no,
          c.id::text AS party_id,
          c.name AS party_name,
          si.grand_total::numeric AS debit,
          0::numeric AS credit
        FROM sales_invoices si
        JOIN customers c ON c.id = si.customer_id
        WHERE si.status IN ('POSTED', 'PARTIALLY_RETURNED', 'FULLY_RETURNED')
          AND ($1::uuid IS NULL OR si.customer_id = $1::uuid)
          AND ($2::date IS NULL OR si.doc_date >= $2::date)
          AND ($3::date IS NULL OR si.doc_date <= $3::date)

        UNION ALL

        SELECT
          'sales-returns'::text AS source_type,
          sr.id::text AS source_id,
          sr.doc_no AS source_no,
          sr.doc_date AS doc_date,
          sr.created_at AS created_at,
          'Sales Return'::text AS description,
          NULL::text AS reference_no,
          c.id::text AS party_id,
          c.name AS party_name,
          0::numeric AS debit,
          sr.grand_total::numeric AS credit
        FROM sales_returns sr
        JOIN customers c ON c.id = sr.customer_id
        WHERE sr.status = 'POSTED'
          AND ($1::uuid IS NULL OR sr.customer_id = $1::uuid)
          AND ($2::date IS NULL OR sr.doc_date >= $2::date)
          AND ($3::date IS NULL OR sr.doc_date <= $3::date)

        UNION ALL

        SELECT
          'customer-receipts'::text AS source_type,
          cr.id::text AS source_id,
          cr.doc_no AS source_no,
          cr.doc_date AS doc_date,
          cr.created_at AS created_at,
          'Customer Receipt'::text AS description,
          cr.reference_no AS reference_no,
          c.id::text AS party_id,
          c.name AS party_name,
          0::numeric AS debit,
          cr.entered_amount::numeric AS credit
        FROM customer_receipts cr
        JOIN customers c ON c.id = cr.customer_id
        WHERE cr.status = 'POSTED'
          AND ($1::uuid IS NULL OR cr.customer_id = $1::uuid)
          AND ($2::date IS NULL OR cr.doc_date >= $2::date)
          AND ($3::date IS NULL OR cr.doc_date <= $3::date)
      ) statement_lines
      ORDER BY doc_date ASC, created_at ASC, source_no ASC
      LIMIT $4
      `,
      customerId,
      dateFrom,
      dateTo,
      limit,
    ));

    const openingBalance = await this.getCustomerOpeningBalance(customerId, dateFrom);
    const running = withRunningBalance(rows, openingBalance, 'customer');

    const totalDebit = round2(rows.reduce((sum, row) => sum + row.debit, 0));
    const totalCredit = round2(rows.reduce((sum, row) => sum + row.credit, 0));

    return {
      type: 'customer',
      openingBalance,
      closingBalance: running.closingBalance,
      totalDebit,
      totalCredit,
      lineCount: rows.length,
      lines: running.lines,
      appliedFilters: { customerId, dateFrom, dateTo, limit },
    };
  }

  async getSupplierStatement(query: StatementQuery = {}) {
    const dateFrom = safeDate(query.dateFrom);
    const dateTo = safeDate(query.dateTo);
    const limit = safeLimit(query.limit);
    const supplierId = query.supplierId?.trim() || null;

    const rows = normalizeRows(await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT * FROM (
        SELECT
          'purchase-invoices'::text AS source_type,
          pi.id::text AS source_id,
          pi.doc_no AS source_no,
          pi.doc_date AS doc_date,
          pi.created_at AS created_at,
          'Purchase Invoice'::text AS description,
          pi.supplier_invoice_no AS reference_no,
          s.id::text AS party_id,
          s.name AS party_name,
          0::numeric AS debit,
          pi.grand_total::numeric AS credit
        FROM purchase_invoices pi
        JOIN suppliers s ON s.id = pi.supplier_id
        WHERE pi.status = 'POSTED'
          AND ($1::uuid IS NULL OR pi.supplier_id = $1::uuid)
          AND ($2::date IS NULL OR pi.doc_date >= $2::date)
          AND ($3::date IS NULL OR pi.doc_date <= $3::date)

        UNION ALL

        SELECT
          'supplier-payments'::text AS source_type,
          sp.id::text AS source_id,
          sp.doc_no AS source_no,
          sp.doc_date AS doc_date,
          sp.created_at AS created_at,
          'Supplier Payment'::text AS description,
          sp.reference_no AS reference_no,
          s.id::text AS party_id,
          s.name AS party_name,
          sp.entered_amount::numeric AS debit,
          0::numeric AS credit
        FROM supplier_payments sp
        JOIN suppliers s ON s.id = sp.supplier_id
        WHERE sp.status = 'POSTED'
          AND ($1::uuid IS NULL OR sp.supplier_id = $1::uuid)
          AND ($2::date IS NULL OR sp.doc_date >= $2::date)
          AND ($3::date IS NULL OR sp.doc_date <= $3::date)
      ) statement_lines
      ORDER BY doc_date ASC, created_at ASC, source_no ASC
      LIMIT $4
      `,
      supplierId,
      dateFrom,
      dateTo,
      limit,
    ));

    const openingBalance = await this.getSupplierOpeningBalance(supplierId, dateFrom);
    const running = withRunningBalance(rows, openingBalance, 'supplier');

    const totalDebit = round2(rows.reduce((sum, row) => sum + row.debit, 0));
    const totalCredit = round2(rows.reduce((sum, row) => sum + row.credit, 0));

    return {
      type: 'supplier',
      openingBalance,
      closingBalance: running.closingBalance,
      totalDebit,
      totalCredit,
      lineCount: rows.length,
      lines: running.lines,
      appliedFilters: { supplierId, dateFrom, dateTo, limit },
    };
  }

  private async getCustomerOpeningBalance(customerId: string | null, dateFrom: string | null) {
    if (!dateFrom) return 0;
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        COALESCE(SUM(debit), 0)::numeric AS debit,
        COALESCE(SUM(credit), 0)::numeric AS credit
      FROM (
        SELECT si.grand_total::numeric AS debit, 0::numeric AS credit
        FROM sales_invoices si
        WHERE si.status IN ('POSTED', 'PARTIALLY_RETURNED', 'FULLY_RETURNED')
          AND ($1::uuid IS NULL OR si.customer_id = $1::uuid)
          AND si.doc_date < $2::date
        UNION ALL
        SELECT 0::numeric AS debit, sr.grand_total::numeric AS credit
        FROM sales_returns sr
        WHERE sr.status = 'POSTED'
          AND ($1::uuid IS NULL OR sr.customer_id = $1::uuid)
          AND sr.doc_date < $2::date
        UNION ALL
        SELECT 0::numeric AS debit, cr.entered_amount::numeric AS credit
        FROM customer_receipts cr
        WHERE cr.status = 'POSTED'
          AND ($1::uuid IS NULL OR cr.customer_id = $1::uuid)
          AND cr.doc_date < $2::date
      ) opening_lines
      `,
      customerId,
      dateFrom,
    );
    const row = rows[0] ?? { debit: 0, credit: 0 };
    return round2(Number(row.debit ?? 0) - Number(row.credit ?? 0));
  }

  private async getSupplierOpeningBalance(supplierId: string | null, dateFrom: string | null) {
    if (!dateFrom) return 0;
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        COALESCE(SUM(debit), 0)::numeric AS debit,
        COALESCE(SUM(credit), 0)::numeric AS credit
      FROM (
        SELECT 0::numeric AS debit, pi.grand_total::numeric AS credit
        FROM purchase_invoices pi
        WHERE pi.status = 'POSTED'
          AND ($1::uuid IS NULL OR pi.supplier_id = $1::uuid)
          AND pi.doc_date < $2::date
        UNION ALL
        SELECT sp.entered_amount::numeric AS debit, 0::numeric AS credit
        FROM supplier_payments sp
        WHERE sp.status = 'POSTED'
          AND ($1::uuid IS NULL OR sp.supplier_id = $1::uuid)
          AND sp.doc_date < $2::date
      ) opening_lines
      `,
      supplierId,
      dateFrom,
    );
    const row = rows[0] ?? { debit: 0, credit: 0 };
    return round2(Number(row.credit ?? 0) - Number(row.debit ?? 0));
  }

  async getCustomerLedger(query: StatementQuery = {}) {
    const dateFrom = safeDate(query.dateFrom);
    const dateTo = safeDate(query.dateTo);
    const limit = safeLimit(query.limit);
    const customerId = query.customerId?.trim() || null;
    const today = new Date().toISOString().slice(0, 10);

    const rows = normalizeLedgerRows(
      await this.prisma.$queryRawUnsafe<any[]>(
        `
        SELECT * FROM (
          SELECT
            'sales-invoices'::text            AS source_type,
            si.id::text                       AS source_id,
            si.doc_no                         AS source_no,
            si.doc_date                       AS doc_date,
            si.due_date                       AS due_date,
            si.created_at                     AS created_at,
            'Faturë Shitje'::text             AS description,
            NULL::text                        AS reference_no,
            c.id::text                        AS party_id,
            c.name                            AS party_name,
            si.grand_total::numeric           AS debit,
            0::numeric                        AS credit,
            GREATEST(0, si.grand_total - si.amount_paid)::numeric AS outstanding,
            si.payment_status::text           AS payment_status
          FROM sales_invoices si
          JOIN customers c ON c.id = si.customer_id
          WHERE si.status IN ('POSTED','PARTIALLY_RETURNED','FULLY_RETURNED')
            AND ($1::uuid IS NULL OR si.customer_id = $1::uuid)
            AND ($2::date IS NULL OR si.doc_date >= $2::date)
            AND ($3::date IS NULL OR si.doc_date <= $3::date)

          UNION ALL

          SELECT
            'sales-returns'::text             AS source_type,
            sr.id::text                       AS source_id,
            sr.doc_no                         AS source_no,
            sr.doc_date                       AS doc_date,
            NULL::date                        AS due_date,
            sr.created_at                     AS created_at,
            'Kthim Shitje'::text              AS description,
            NULL::text                        AS reference_no,
            c.id::text                        AS party_id,
            c.name                            AS party_name,
            0::numeric                        AS debit,
            sr.grand_total::numeric           AS credit,
            0::numeric                        AS outstanding,
            NULL::text                        AS payment_status
          FROM sales_returns sr
          JOIN customers c ON c.id = sr.customer_id
          WHERE sr.status = 'POSTED'
            AND ($1::uuid IS NULL OR sr.customer_id = $1::uuid)
            AND ($2::date IS NULL OR sr.doc_date >= $2::date)
            AND ($3::date IS NULL OR sr.doc_date <= $3::date)

          UNION ALL

          SELECT
            'customer-receipts'::text         AS source_type,
            cr.id::text                       AS source_id,
            cr.doc_no                         AS source_no,
            cr.doc_date                       AS doc_date,
            NULL::date                        AS due_date,
            cr.created_at                     AS created_at,
            'Arketim'::text                   AS description,
            cr.reference_no                   AS reference_no,
            c.id::text                        AS party_id,
            c.name                            AS party_name,
            0::numeric                        AS debit,
            cr.entered_amount::numeric        AS credit,
            0::numeric                        AS outstanding,
            NULL::text                        AS payment_status
          FROM customer_receipts cr
          JOIN customers c ON c.id = cr.customer_id
          WHERE cr.status = 'POSTED'
            AND ($1::uuid IS NULL OR cr.customer_id = $1::uuid)
            AND ($2::date IS NULL OR cr.doc_date >= $2::date)
            AND ($3::date IS NULL OR cr.doc_date <= $3::date)
        ) ledger_lines
        ORDER BY doc_date ASC, created_at ASC, source_no ASC
        LIMIT $4
        `,
        customerId,
        dateFrom,
        dateTo,
        limit,
      ),
    );

    const openingBalance = await this.getCustomerOpeningBalance(customerId, dateFrom);
    const running = withLedgerRunningBalance(rows, openingBalance, 'customer');
    const aging = calculateAgingBuckets(rows, today);

    const totalDebit = round2(rows.reduce((sum, row) => sum + row.debit, 0));
    const totalCredit = round2(rows.reduce((sum, row) => sum + row.credit, 0));
    const totalOutstanding = round2(rows.reduce((sum, row) => sum + row.outstanding, 0));

    return {
      type: 'customer',
      openingBalance,
      closingBalance: running.closingBalance,
      totalDebit,
      totalCredit,
      totalOutstanding,
      aging,
      lineCount: rows.length,
      lines: running.lines,
      appliedFilters: { customerId, dateFrom, dateTo, limit },
    };
  }

  async getSupplierLedger(query: StatementQuery = {}) {
    const dateFrom = safeDate(query.dateFrom);
    const dateTo = safeDate(query.dateTo);
    const limit = safeLimit(query.limit);
    const supplierId = query.supplierId?.trim() || null;
    const today = new Date().toISOString().slice(0, 10);

    const rows = normalizeLedgerRows(
      await this.prisma.$queryRawUnsafe<any[]>(
        `
        SELECT * FROM (
          SELECT
            'purchase-invoices'::text         AS source_type,
            pi.id::text                       AS source_id,
            pi.doc_no                         AS source_no,
            pi.doc_date                       AS doc_date,
            pi.due_date                       AS due_date,
            pi.created_at                     AS created_at,
            'Faturë Blerje'::text             AS description,
            pi.supplier_invoice_no            AS reference_no,
            s.id::text                        AS party_id,
            s.name                            AS party_name,
            0::numeric                        AS debit,
            pi.grand_total::numeric           AS credit,
            GREATEST(0, pi.grand_total - pi.amount_paid)::numeric AS outstanding,
            pi.payment_status::text           AS payment_status
          FROM purchase_invoices pi
          JOIN suppliers s ON s.id = pi.supplier_id
          WHERE pi.status = 'POSTED'
            AND ($1::uuid IS NULL OR pi.supplier_id = $1::uuid)
            AND ($2::date IS NULL OR pi.doc_date >= $2::date)
            AND ($3::date IS NULL OR pi.doc_date <= $3::date)

          UNION ALL

          SELECT
            'supplier-payments'::text         AS source_type,
            sp.id::text                       AS source_id,
            sp.doc_no                         AS source_no,
            sp.doc_date                       AS doc_date,
            NULL::date                        AS due_date,
            sp.created_at                     AS created_at,
            'Pagesë'::text                    AS description,
            sp.reference_no                   AS reference_no,
            s.id::text                        AS party_id,
            s.name                            AS party_name,
            sp.entered_amount::numeric        AS debit,
            0::numeric                        AS credit,
            0::numeric                        AS outstanding,
            NULL::text                        AS payment_status
          FROM supplier_payments sp
          JOIN suppliers s ON s.id = sp.supplier_id
          WHERE sp.status = 'POSTED'
            AND ($1::uuid IS NULL OR sp.supplier_id = $1::uuid)
            AND ($2::date IS NULL OR sp.doc_date >= $2::date)
            AND ($3::date IS NULL OR sp.doc_date <= $3::date)
        ) ledger_lines
        ORDER BY doc_date ASC, created_at ASC, source_no ASC
        LIMIT $4
        `,
        supplierId,
        dateFrom,
        dateTo,
        limit,
      ),
    );

    const openingBalance = await this.getSupplierOpeningBalance(supplierId, dateFrom);
    const running = withLedgerRunningBalance(rows, openingBalance, 'supplier');
    const aging = calculateAgingBuckets(rows, today);

    const totalDebit = round2(rows.reduce((sum, row) => sum + row.debit, 0));
    const totalCredit = round2(rows.reduce((sum, row) => sum + row.credit, 0));
    const totalOutstanding = round2(rows.reduce((sum, row) => sum + row.outstanding, 0));

    return {
      type: 'supplier',
      openingBalance,
      closingBalance: running.closingBalance,
      totalDebit,
      totalCredit,
      totalOutstanding,
      aging,
      lineCount: rows.length,
      lines: running.lines,
      appliedFilters: { supplierId, dateFrom, dateTo, limit },
    };
  }
}
