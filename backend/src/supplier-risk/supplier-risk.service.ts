import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { round2 } from '../common/utils/money';

type SupplierRiskQuery = {
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
export class SupplierRiskService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: SupplierRiskQuery = {}) {
    const limit = parseLimit(query.limit);
    const riskFilter = normalizeRisk(query.risk);
    const search = query.search?.trim() || null;

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      WITH invoice_base AS (
        SELECT
          pi.supplier_id,
          COUNT(*) FILTER (WHERE pi.status = 'POSTED')::int AS invoice_count,
          COUNT(*) FILTER (
            WHERE pi.status = 'POSTED'
              AND GREATEST(0, pi.grand_total - pi.amount_paid) > 0
          )::int AS open_invoice_count,
          COUNT(*) FILTER (
            WHERE pi.status = 'POSTED'
              AND pi.due_date IS NOT NULL
              AND pi.due_date < CURRENT_DATE
              AND GREATEST(0, pi.grand_total - pi.amount_paid) > 0
          )::int AS overdue_invoice_count,
          COALESCE(SUM(GREATEST(0, pi.grand_total - pi.amount_paid)) FILTER (WHERE pi.status = 'POSTED'), 0)::numeric AS payable_amount,
          COALESCE(SUM(GREATEST(0, pi.grand_total - pi.amount_paid)) FILTER (
            WHERE pi.status = 'POSTED'
              AND pi.due_date IS NOT NULL
              AND pi.due_date < CURRENT_DATE
          ), 0)::numeric AS overdue_amount,
          COALESCE(MAX(CASE
            WHEN pi.status = 'POSTED'
              AND pi.due_date IS NOT NULL
              AND pi.due_date < CURRENT_DATE
              AND GREATEST(0, pi.grand_total - pi.amount_paid) > 0
            THEN CURRENT_DATE - pi.due_date
            ELSE 0
          END), 0)::int AS max_days_overdue,
          MAX(pi.doc_date) FILTER (WHERE pi.status = 'POSTED') AS last_invoice_date
        FROM purchase_invoices pi
        GROUP BY pi.supplier_id
      ), payment_base AS (
        SELECT
          sp.supplier_id,
          COUNT(*) FILTER (WHERE sp.status = 'POSTED')::int AS payment_count,
          COALESCE(SUM(sp.entered_amount) FILTER (WHERE sp.status = 'POSTED'), 0)::numeric AS total_payments,
          COALESCE(SUM(sp.unapplied_amount) FILTER (WHERE sp.status = 'POSTED'), 0)::numeric AS unapplied_payments,
          MAX(sp.doc_date) FILTER (WHERE sp.status = 'POSTED') AS last_payment_date
        FROM supplier_payments sp
        GROUP BY sp.supplier_id
      )
      SELECT
        s.id::text AS supplier_id,
        s.code AS supplier_code,
        s.name AS supplier_name,
        s.city,
        s.phone,
        s.email,
        COALESCE(i.invoice_count, 0)::int AS invoice_count,
        COALESCE(i.open_invoice_count, 0)::int AS open_invoice_count,
        COALESCE(i.overdue_invoice_count, 0)::int AS overdue_invoice_count,
        COALESCE(i.payable_amount, 0)::numeric AS payable_amount,
        COALESCE(i.overdue_amount, 0)::numeric AS overdue_amount,
        COALESCE(i.max_days_overdue, 0)::int AS max_days_overdue,
        COALESCE(p.payment_count, 0)::int AS payment_count,
        COALESCE(p.total_payments, 0)::numeric AS total_payments,
        COALESCE(p.unapplied_payments, 0)::numeric AS unapplied_payments,
        i.last_invoice_date,
        p.last_payment_date
      FROM suppliers s
      LEFT JOIN invoice_base i ON i.supplier_id = s.id
      LEFT JOIN payment_base p ON p.supplier_id = s.id
      WHERE s.is_active = true
        AND ($1::text IS NULL OR s.name ILIKE '%' || $1 || '%' OR s.code ILIKE '%' || $1 || '%' OR s.city ILIKE '%' || $1 || '%')
      ORDER BY COALESCE(i.overdue_amount, 0) DESC, COALESCE(i.max_days_overdue, 0) DESC, COALESCE(i.payable_amount, 0) DESC, s.name ASC
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
        acc.payableAmount = round2(acc.payableAmount + item.payableAmount);
        acc.overdueAmount = round2(acc.overdueAmount + item.overdueAmount);
        acc.unappliedPayments = round2(acc.unappliedPayments + item.unappliedPayments);
        acc[item.riskLevel.toLowerCase() as 'low' | 'medium' | 'high' | 'critical'] += 1;
        return acc;
      },
      { total: 0, low: 0, medium: 0, high: 0, critical: 0, payableAmount: 0, overdueAmount: 0, unappliedPayments: 0 },
    );

    return {
      summary,
      items,
      appliedFilters: { search, risk: riskFilter, limit },
      generatedAt: new Date().toISOString(),
    };
  }

  private mapRow(row: any) {
    const payableAmount = numberValue(row.payable_amount);
    const overdueAmount = numberValue(row.overdue_amount);
    const maxDaysOverdue = numberValue(row.max_days_overdue);
    const overdueInvoiceCount = numberValue(row.overdue_invoice_count);
    const openInvoiceCount = numberValue(row.open_invoice_count);
    const unappliedPayments = numberValue(row.unapplied_payments);

    let score = 0;
    score += Math.min(35, overdueAmount / 75);
    score += Math.min(25, maxDaysOverdue / 2.5);
    score += Math.min(15, overdueInvoiceCount * 5);
    score += Math.min(10, openInvoiceCount * 1.5);
    score += Math.min(20, unappliedPayments / 50);

    const riskScore = clamp(score);
    const level = riskLevel(riskScore);
    const signals = [
      signal(`${round2(overdueAmount)} EUR overdue payables`, overdueAmount > 0),
      signal(`${maxDaysOverdue} max days overdue`, maxDaysOverdue > 0),
      signal(`${overdueInvoiceCount} overdue purchase invoice(s)`, overdueInvoiceCount > 0),
      signal(`${round2(payableAmount)} EUR open payable`, payableAmount > 0),
      signal(`${round2(unappliedPayments)} EUR unapplied supplier payments`, unappliedPayments > 0),
    ].filter(Boolean) as string[];

    if (!signals.length) signals.push('No active supplier financial risk detected');

    return {
      supplierId: row.supplier_id,
      supplierCode: row.supplier_code,
      supplierName: row.supplier_name,
      city: row.city ?? null,
      phone: row.phone ?? null,
      email: row.email ?? null,
      riskScore,
      riskLevel: level,
      invoiceCount: numberValue(row.invoice_count),
      openInvoiceCount,
      overdueInvoiceCount,
      payableAmount: round2(payableAmount),
      overdueAmount: round2(overdueAmount),
      maxDaysOverdue,
      paymentCount: numberValue(row.payment_count),
      totalPayments: round2(numberValue(row.total_payments)),
      unappliedPayments: round2(unappliedPayments),
      lastInvoiceDate: row.last_invoice_date ?? null,
      lastPaymentDate: row.last_payment_date ?? null,
      signals,
    };
  }
}
