import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { round2 } from '../common/utils/money';

type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
type ExceptionCategory = 'FINANCE' | 'COLLECTIONS' | 'PAYABLES' | 'STOCK' | 'CONTROL';

type ExceptionQuery = {
  category?: string;
  severity?: string;
};

type ExceptionItem = {
  id: string;
  category: ExceptionCategory;
  severity: Severity;
  title: string;
  description: string;
  entityType: string;
  entityId: string;
  entityNo: string | null;
  partyName: string | null;
  amount: number;
  stockQty: number;
  daysOverdue: number | null;
  sourceUrl: string | null;
  createdAt: Date | string | null;
};

const CATEGORIES: ExceptionCategory[] = ['FINANCE', 'COLLECTIONS', 'PAYABLES', 'STOCK', 'CONTROL'];
const SEVERITIES: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

function normalizeCategory(value?: string): ExceptionCategory | null {
  const normalized = value?.trim().toUpperCase();
  return CATEGORIES.includes(normalized as ExceptionCategory) ? (normalized as ExceptionCategory) : null;
}

function normalizeSeverity(value?: string): Severity | null {
  const normalized = value?.trim().toUpperCase();
  return SEVERITIES.includes(normalized as Severity) ? (normalized as Severity) : null;
}

function severityRank(severity: Severity) {
  if (severity === 'CRITICAL') return 4;
  if (severity === 'HIGH') return 3;
  if (severity === 'MEDIUM') return 2;
  return 1;
}

function toNumber(value: unknown) {
  return round2(Number(value ?? 0));
}

function mapRow(row: any): ExceptionItem {
  return {
    id: row.id,
    category: row.category,
    severity: row.severity,
    title: row.title,
    description: row.description,
    entityType: row.entity_type,
    entityId: row.entity_id,
    entityNo: row.entity_no ?? null,
    partyName: row.party_name ?? null,
    amount: toNumber(row.amount),
    stockQty: toNumber(row.stock_qty),
    daysOverdue: row.days_overdue === null || row.days_overdue === undefined ? null : Number(row.days_overdue),
    sourceUrl: row.source_url ?? null,
    createdAt: row.created_at ?? null,
  };
}

@Injectable()
export class ControlTowerService {
  constructor(private readonly prisma: PrismaService) {}

  async getExceptions(query: ExceptionQuery = {}) {
    const category = normalizeCategory(query.category);
    const severity = normalizeSeverity(query.severity);

    const [salesOverdue, purchaseOverdue, unappliedReceipts, unappliedPayments, negativeAccounts, stockAlerts] =
      await Promise.all([
        this.getSalesOverdue(),
        this.getPurchaseOverdue(),
        this.getUnappliedReceipts(),
        this.getUnappliedSupplierPayments(),
        this.getNegativeFinanceAccounts(),
        this.getStockAlerts(),
      ]);

    const allItems = [
      ...salesOverdue,
      ...purchaseOverdue,
      ...unappliedReceipts,
      ...unappliedPayments,
      ...negativeAccounts,
      ...stockAlerts,
    ].sort((left, right) => {
      const severityDiff = severityRank(right.severity) - severityRank(left.severity);
      if (severityDiff !== 0) return severityDiff;
      return Number(right.amount ?? 0) - Number(left.amount ?? 0);
    });

    const filteredItems = allItems.filter((item) => {
      if (category && item.category !== category) return false;
      if (severity && item.severity !== severity) return false;
      return true;
    });

    const fullBySeverity = this.groupCount(allItems, 'severity');
    const fullByCategory = this.groupCount(allItems, 'category');
    const filteredBySeverity = this.groupCount(filteredItems, 'severity');
    const filteredByCategory = this.groupCount(filteredItems, 'category');

    const financialCategories = new Set<ExceptionCategory>(['FINANCE', 'COLLECTIONS', 'PAYABLES', 'CONTROL']);
    const financialExposureAmount = round2(
      filteredItems
        .filter((item) => financialCategories.has(item.category))
        .reduce((sum, item) => sum + Number(item.amount ?? 0), 0),
    );
    const stockExceptionQty = round2(
      filteredItems
        .filter((item) => item.category === 'STOCK')
        .reduce((sum, item) => sum + Number(item.stockQty ?? 0), 0),
    );

    return {
      summary: {
        total: filteredItems.length,
        totalAll: allItems.length,
        critical: filteredBySeverity.CRITICAL ?? 0,
        high: filteredBySeverity.HIGH ?? 0,
        medium: filteredBySeverity.MEDIUM ?? 0,
        low: filteredBySeverity.LOW ?? 0,
        financialExposureAmount,
        stockExceptionQty,
        financeCount: filteredByCategory.FINANCE ?? 0,
        collectionsCount: filteredByCategory.COLLECTIONS ?? 0,
        payablesCount: filteredByCategory.PAYABLES ?? 0,
        stockCount: filteredByCategory.STOCK ?? 0,
        controlCount: filteredByCategory.CONTROL ?? 0,
      },
      bySeverity: filteredBySeverity,
      byCategory: filteredByCategory,
      availableFilters: {
        bySeverity: fullBySeverity,
        byCategory: fullByCategory,
      },
      items: filteredItems,
      appliedFilters: { category, severity },
      generatedAt: new Date().toISOString(),
    };
  }

  private groupCount(items: ExceptionItem[], key: 'severity' | 'category') {
    return items.reduce<Record<string, number>>((acc, item) => {
      const value = item[key];
      acc[value] = (acc[value] ?? 0) + 1;
      return acc;
    }, {});
  }

  private async getSalesOverdue() {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT
        ('sales-overdue-' || si.id)::text AS id,
        'COLLECTIONS'::text AS category,
        CASE
          WHEN (CURRENT_DATE - si.due_date) > 60 THEN 'CRITICAL'
          WHEN (CURRENT_DATE - si.due_date) > 30 THEN 'HIGH'
          ELSE 'MEDIUM'
        END AS severity,
        'Overdue customer invoice'::text AS title,
        ('Customer invoice ' || si.doc_no || ' is overdue by ' || (CURRENT_DATE - si.due_date)::text || ' days')::text AS description,
        'sales-invoices'::text AS entity_type,
        si.id::text AS entity_id,
        si.doc_no AS entity_no,
        c.name AS party_name,
        GREATEST(0, si.grand_total - si.amount_paid - COALESCE(r.return_total, 0))::numeric AS amount,
        0::numeric AS stock_qty,
        (CURRENT_DATE - si.due_date)::int AS days_overdue,
        ('/sales-invoices/' || si.id)::text AS source_url,
        si.created_at AS created_at
      FROM sales_invoices si
      JOIN customers c ON c.id = si.customer_id
      LEFT JOIN (
        SELECT sales_invoice_id, SUM(grand_total) AS return_total
        FROM sales_returns
        WHERE status = 'POSTED'
        GROUP BY sales_invoice_id
      ) r ON r.sales_invoice_id = si.id
      WHERE si.status IN ('POSTED', 'PARTIALLY_RETURNED', 'FULLY_RETURNED')
        AND si.due_date IS NOT NULL
        AND si.due_date < CURRENT_DATE
        AND GREATEST(0, si.grand_total - si.amount_paid - COALESCE(r.return_total, 0)) > 0
      ORDER BY days_overdue DESC, amount DESC
      LIMIT 50
    `);
    return rows.map(mapRow);
  }

  private async getPurchaseOverdue() {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT
        ('purchase-overdue-' || pi.id)::text AS id,
        'PAYABLES'::text AS category,
        CASE
          WHEN (CURRENT_DATE - pi.due_date) > 60 THEN 'CRITICAL'
          WHEN (CURRENT_DATE - pi.due_date) > 30 THEN 'HIGH'
          ELSE 'MEDIUM'
        END AS severity,
        'Overdue supplier invoice'::text AS title,
        ('Supplier invoice ' || pi.doc_no || ' is overdue by ' || (CURRENT_DATE - pi.due_date)::text || ' days')::text AS description,
        'purchase-invoices'::text AS entity_type,
        pi.id::text AS entity_id,
        pi.doc_no AS entity_no,
        s.name AS party_name,
        GREATEST(0, pi.grand_total - pi.amount_paid)::numeric AS amount,
        0::numeric AS stock_qty,
        (CURRENT_DATE - pi.due_date)::int AS days_overdue,
        ('/purchase-invoices/' || pi.id)::text AS source_url,
        pi.created_at AS created_at
      FROM purchase_invoices pi
      JOIN suppliers s ON s.id = pi.supplier_id
      WHERE pi.status = 'POSTED'
        AND pi.due_date IS NOT NULL
        AND pi.due_date < CURRENT_DATE
        AND GREATEST(0, pi.grand_total - pi.amount_paid) > 0
      ORDER BY days_overdue DESC, amount DESC
      LIMIT 50
    `);
    return rows.map(mapRow);
  }

  private async getUnappliedReceipts() {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT
        ('unapplied-receipt-' || cr.id)::text AS id,
        'FINANCE'::text AS category,
        CASE WHEN cr.unapplied_amount >= 1000 THEN 'HIGH' ELSE 'MEDIUM' END AS severity,
        'Unapplied customer receipt'::text AS title,
        ('Customer receipt ' || cr.doc_no || ' has unapplied amount')::text AS description,
        'customer-receipts'::text AS entity_type,
        cr.id::text AS entity_id,
        cr.doc_no AS entity_no,
        c.name AS party_name,
        cr.unapplied_amount::numeric AS amount,
        0::numeric AS stock_qty,
        NULL::int AS days_overdue,
        '/customer-receipts'::text AS source_url,
        cr.created_at AS created_at
      FROM customer_receipts cr
      JOIN customers c ON c.id = cr.customer_id
      WHERE cr.status = 'POSTED'
        AND cr.unapplied_amount > 0
      ORDER BY cr.unapplied_amount DESC
      LIMIT 50
    `);
    return rows.map(mapRow);
  }

  private async getUnappliedSupplierPayments() {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT
        ('unapplied-supplier-payment-' || sp.id)::text AS id,
        'FINANCE'::text AS category,
        CASE WHEN sp.unapplied_amount >= 1000 THEN 'HIGH' ELSE 'MEDIUM' END AS severity,
        'Unapplied supplier payment'::text AS title,
        ('Supplier payment ' || sp.doc_no || ' has unapplied amount')::text AS description,
        'supplier-payments'::text AS entity_type,
        sp.id::text AS entity_id,
        sp.doc_no AS entity_no,
        s.name AS party_name,
        sp.unapplied_amount::numeric AS amount,
        0::numeric AS stock_qty,
        NULL::int AS days_overdue,
        '/supplier-payments'::text AS source_url,
        sp.created_at AS created_at
      FROM supplier_payments sp
      JOIN suppliers s ON s.id = sp.supplier_id
      WHERE sp.status = 'POSTED'
        AND sp.unapplied_amount > 0
      ORDER BY sp.unapplied_amount DESC
      LIMIT 50
    `);
    return rows.map(mapRow);
  }

  private async getNegativeFinanceAccounts() {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT
        ('negative-account-' || fa.id)::text AS id,
        'CONTROL'::text AS category,
        'HIGH'::text AS severity,
        'Negative cash/bank balance'::text AS title,
        ('Finance account ' || fa.code || ' has negative balance')::text AS description,
        'finance-accounts'::text AS entity_type,
        fa.id::text AS entity_id,
        fa.code AS entity_no,
        fa.name AS party_name,
        ABS(fa.current_balance)::numeric AS amount,
        0::numeric AS stock_qty,
        NULL::int AS days_overdue,
        '/financa/llogarite'::text AS source_url,
        fa.updated_at AS created_at
      FROM finance_accounts fa
      WHERE fa.current_balance < 0
      ORDER BY ABS(fa.current_balance) DESC
      LIMIT 20
    `);
    return rows.map(mapRow);
  }

  private async getStockAlerts() {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT
        ('stock-alert-' || sb.warehouse_id || '-' || sb.item_id)::text AS id,
        'STOCK'::text AS category,
        CASE WHEN sb.qty_on_hand <= 0 THEN 'HIGH' ELSE 'LOW' END AS severity,
        CASE WHEN sb.qty_on_hand <= 0 THEN 'Stockout risk' ELSE 'Low stock warning' END AS title,
        (i.code || ' - ' || i.name || ' has qty ' || sb.qty_on_hand::text || ' in ' || w.name)::text AS description,
        'stock-balances'::text AS entity_type,
        sb.item_id::text AS entity_id,
        i.code AS entity_no,
        w.name AS party_name,
        0::numeric AS amount,
        GREATEST(0, 5 - sb.qty_on_hand)::numeric AS stock_qty,
        NULL::int AS days_overdue,
        '/stock/balances'::text AS source_url,
        sb.updated_at AS created_at
      FROM stock_balances sb
      JOIN items i ON i.id = sb.item_id
      JOIN warehouses w ON w.id = sb.warehouse_id
      WHERE sb.qty_on_hand <= 5
      ORDER BY sb.qty_on_hand ASC, i.name ASC
      LIMIT 50
    `);
    return rows.map(mapRow);
  }
}
