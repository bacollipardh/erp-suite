import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { round2 } from '../common/utils/money';

type CustomerRiskQuery = {
  search?: string;
  risk?: string;
  limit?: string;
};

type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

function numberValue(value: unknown) {
  return Number(value ?? 0);
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function riskLevel(score: number): RiskLevel {
  if (score >= 80) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 35) return 'MEDIUM';
  return 'LOW';
}

function parseLimit(value?: string) {
  const parsed = Number(value ?? 50);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(1, Math.min(200, Math.trunc(parsed)));
}

function normalizeRisk(value?: string): RiskLevel | null {
  const normalized = value?.trim().toUpperCase();
  if (normalized === 'LOW' || normalized === 'MEDIUM' || normalized === 'HIGH' || normalized === 'CRITICAL') return normalized;
  return null;
}

function signal(text: string, active: boolean) {
  return active ? text : null;
}

@Injectable()
export class CustomerRiskService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: CustomerRiskQuery = {}) {
    const limit = parseLimit(query.limit);
    const riskFilter = normalizeRisk(query.risk);
    const search = query.search?.trim() || null;

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      WITH invoice_base AS (
        SELECT
          si.customer_id,
          COUNT(*) FILTER (WHERE si.status IN ('POSTED', 'PARTIALLY_RETURNED', 'FULLY_RETURNED'))::int AS invoice_count,
          COUNT(*) FILTER (
            WHERE si.status IN ('POSTED', 'PARTIALLY_RETURNED', 'FULLY_RETURNED')
              AND GREATEST(0, si.grand_total - si.amount_paid - COALESCE(r.return_total, 0)) > 0
          )::int AS open_invoice_count,
          COUNT(*) FILTER (
            WHERE si.status IN ('POSTED', 'PARTIALLY_RETURNED', 'FULLY_RETURNED')
              AND si.due_date IS NOT NULL
              AND si.due_date < CURRENT_DATE
              AND GREATEST(0, si.grand_total - si.amount_paid - COALESCE(r.return_total, 0)) > 0
          )::int AS overdue_invoice_count,
          COALESCE(SUM(GREATEST(0, si.grand_total - si.amount_paid - COALESCE(r.return_total, 0))) FILTER (
            WHERE si.status IN ('POSTED', 'PARTIALLY_RETURNED', 'FULLY_RETURNED')
          ), 0)::numeric AS outstanding_amount,
          COALESCE(SUM(GREATEST(0, si.grand_total - si.amount_paid - COALESCE(r.return_total, 0))) FILTER (
            WHERE si.status IN ('POSTED', 'PARTIALLY_RETURNED', 'FULLY_RETURNED')
              AND si.due_date IS NOT NULL
              AND si.due_date < CURRENT_DATE
          ), 0)::numeric AS overdue_amount,
          COALESCE(MAX(CASE
            WHEN si.status IN ('POSTED', 'PARTIALLY_RETURNED', 'FULLY_RETURNED')
              AND si.due_date IS NOT NULL
              AND si.due_date < CURRENT_DATE
              AND GREATEST(0, si.grand_total - si.amount_paid - COALESCE(r.return_total, 0)) > 0
            THEN CURRENT_DATE - si.due_date
            ELSE 0
          END), 0)::int AS max_days_overdue,
          MAX(si.doc_date) FILTER (WHERE si.status IN ('POSTED', 'PARTIALLY_RETURNED', 'FULLY_RETURNED')) AS last_invoice_date
        FROM sales_invoices si
        LEFT JOIN (
          SELECT sales_invoice_id, SUM(grand_total) AS return_total
          FROM sales_returns
          WHERE status = 'POSTED'
          GROUP BY sales_invoice_id
        ) r ON r.sales_invoice_id = si.id
        GROUP BY si.customer_id
      ), receipt_base AS (
        SELECT
          cr.customer_id,
          COUNT(*) FILTER (WHERE cr.status = 'POSTED')::int AS receipt_count,
          COALESCE(SUM(cr.entered_amount) FILTER (WHERE cr.status = 'POSTED'), 0)::numeric AS total_receipts,
          COALESCE(SUM(cr.unapplied_amount) FILTER (WHERE cr.status = 'POSTED'), 0)::numeric AS unapplied_receipts,
          MAX(cr.doc_date) FILTER (WHERE cr.status = 'POSTED') AS last_receipt_date
        FROM customer_receipts cr
        GROUP BY cr.customer_id
      )
      SELECT
        c.id::text AS customer_id,
        c.code AS customer_code,
        c.name AS customer_name,
        c.city,
        c.phone,
        c.email,
        c.credit_limit::numeric AS credit_limit,
        COALESCE(i.invoice_count, 0)::int AS invoice_count,
        COALESCE(i.open_invoice_count, 0)::int AS open_invoice_count,
        COALESCE(i.overdue_invoice_count, 0)::int AS overdue_invoice_count,
        COALESCE(i.outstanding_amount, 0)::numeric AS outstanding_amount,
        COALESCE(i.overdue_amount, 0)::numeric AS overdue_amount,
        COALESCE(i.max_days_overdue, 0)::int AS max_days_overdue,
        COALESCE(r.receipt_count, 0)::int AS receipt_count,
        COALESCE(r.total_receipts, 0)::numeric AS total_receipts,
        COALESCE(r.unapplied_receipts, 0)::numeric AS unapplied_receipts,
        i.last_invoice_date,
        r.last_receipt_date
      FROM customers c
      LEFT JOIN invoice_base i ON i.customer_id = c.id
      LEFT JOIN receipt_base r ON r.customer_id = c.id
      WHERE c.is_active = true
        AND ($1::text IS NULL OR c.name ILIKE '%' || $1 || '%' OR c.code ILIKE '%' || $1 || '%' OR c.city ILIKE '%' || $1 || '%')
      ORDER BY COALESCE(i.overdue_amount, 0) DESC, COALESCE(i.max_days_overdue, 0) DESC, COALESCE(i.outstanding_amount, 0) DESC, c.name ASC
      LIMIT $2
      `,
      search,
      limit,
    );

    const items = rows
      .map((row) => this.mapRow(row))
      .filter((item) => (riskFilter ? item.riskLevel === riskFilter : true));

    const summary = items.reduce(
      (acc, item) => {
        acc.total += 1;
        acc.outstandingAmount = round2(acc.outstandingAmount + item.outstandingAmount);
        acc.overdueAmount = round2(acc.overdueAmount + item.overdueAmount);
        acc.unappliedReceipts = round2(acc.unappliedReceipts + item.unappliedReceipts);
        acc[item.riskLevel.toLowerCase() as 'low' | 'medium' | 'high' | 'critical'] += 1;
        return acc;
      },
      { total: 0, low: 0, medium: 0, high: 0, critical: 0, outstandingAmount: 0, overdueAmount: 0, unappliedReceipts: 0 },
    );

    return {
      summary,
      items,
      appliedFilters: { search, risk: riskFilter, limit },
      generatedAt: new Date().toISOString(),
    };
  }

  private mapRow(row: any) {
    const outstandingAmount = numberValue(row.outstanding_amount);
    const overdueAmount = numberValue(row.overdue_amount);
    const maxDaysOverdue = numberValue(row.max_days_overdue);
    const overdueInvoiceCount = numberValue(row.overdue_invoice_count);
    const openInvoiceCount = numberValue(row.open_invoice_count);
    const unappliedReceipts = numberValue(row.unapplied_receipts);
    const creditLimit = row.credit_limit === null || row.credit_limit === undefined ? 0 : numberValue(row.credit_limit);
    const creditUsagePercent = creditLimit > 0 ? (outstandingAmount / creditLimit) * 100 : 0;

    let score = 0;
    score += Math.min(35, overdueAmount / 50);
    score += Math.min(25, maxDaysOverdue / 2);
    score += Math.min(15, overdueInvoiceCount * 5);
    score += Math.min(15, openInvoiceCount * 2);
    if (creditLimit > 0 && outstandingAmount > creditLimit) score += 10;
    if (unappliedReceipts > 0 && overdueAmount > 0) score -= Math.min(10, unappliedReceipts / 100);

    const riskScore = clamp(score);
    const level = riskLevel(riskScore);
    const signals = [
      signal(`${round2(overdueAmount)} EUR overdue`, overdueAmount > 0),
      signal(`${maxDaysOverdue} max days overdue`, maxDaysOverdue > 0),
      signal(`${overdueInvoiceCount} overdue invoice(s)`, overdueInvoiceCount > 0),
      signal(`${round2(outstandingAmount)} EUR outstanding`, outstandingAmount > 0),
      signal(`${round2(creditUsagePercent)}% credit usage`, creditLimit > 0),
      signal(`${round2(unappliedReceipts)} EUR unapplied receipts`, unappliedReceipts > 0),
    ].filter(Boolean) as string[];

    if (!signals.length) signals.push('No active customer financial risk detected');

    return {
      customerId: row.customer_id,
      customerCode: row.customer_code,
      customerName: row.customer_name,
      city: row.city ?? null,
      phone: row.phone ?? null,
      email: row.email ?? null,
      riskScore,
      riskLevel: level,
      creditLimit: round2(creditLimit),
      creditUsagePercent: round2(creditUsagePercent),
      invoiceCount: numberValue(row.invoice_count),
      openInvoiceCount,
      overdueInvoiceCount,
      outstandingAmount: round2(outstandingAmount),
      overdueAmount: round2(overdueAmount),
      maxDaysOverdue,
      receiptCount: numberValue(row.receipt_count),
      totalReceipts: round2(numberValue(row.total_receipts)),
      unappliedReceipts: round2(unappliedReceipts),
      lastInvoiceDate: row.last_invoice_date ?? null,
      lastReceiptDate: row.last_receipt_date ?? null,
      signals,
    };
  }
}
