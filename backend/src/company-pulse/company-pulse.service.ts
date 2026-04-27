import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { round2 } from '../common/utils/money';

type PulseComponent = {
  key: string;
  label: string;
  score: number;
  status: 'EXCELLENT' | 'GOOD' | 'WATCH' | 'RISK' | 'CRITICAL';
  weight: number;
  metrics: Record<string, number>;
  signals: string[];
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreStatus(score: number): PulseComponent['status'] {
  if (score >= 90) return 'EXCELLENT';
  if (score >= 75) return 'GOOD';
  if (score >= 55) return 'WATCH';
  if (score >= 35) return 'RISK';
  return 'CRITICAL';
}

function component(key: string, label: string, score: number, weight: number, metrics: Record<string, number>, signals: string[]): PulseComponent {
  const normalizedScore = clampScore(score);
  return {
    key,
    label,
    score: normalizedScore,
    status: scoreStatus(normalizedScore),
    weight,
    metrics,
    signals,
  };
}

function numberValue(value: unknown) {
  return Number(value ?? 0);
}

@Injectable()
export class CompanyPulseService {
  constructor(private readonly prisma: PrismaService) {}

  async getPulse() {
    const [finance, collections, payables, stock, workflow] = await Promise.all([
      this.getFinanceComponent(),
      this.getCollectionsComponent(),
      this.getPayablesComponent(),
      this.getStockComponent(),
      this.getWorkflowComponent(),
    ]);

    const components = [finance, collections, payables, stock, workflow];
    const totalWeight = components.reduce((sum, item) => sum + item.weight, 0);
    const overallScore = clampScore(
      components.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight,
    );

    return {
      score: overallScore,
      status: scoreStatus(overallScore),
      components,
      generatedAt: new Date().toISOString(),
      interpretation: this.interpret(overallScore),
    };
  }

  private interpret(score: number) {
    if (score >= 90) return 'Company health is excellent. Keep monitoring exceptions and cash discipline.';
    if (score >= 75) return 'Company health is good. A few operational issues need follow-up.';
    if (score >= 55) return 'Company health needs attention. Review finance, collections and stock exceptions.';
    if (score >= 35) return 'Company health is risky. Immediate operational follow-up is recommended.';
    return 'Company health is critical. Management intervention is required.';
  }

  private async getFinanceComponent() {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT
        COALESCE(SUM(CASE WHEN cr.status = 'POSTED' THEN cr.unapplied_amount ELSE 0 END), 0)::numeric AS unapplied_receipts,
        COALESCE((SELECT SUM(sp.unapplied_amount) FROM supplier_payments sp WHERE sp.status = 'POSTED'), 0)::numeric AS unapplied_payments,
        COALESCE((SELECT COUNT(*) FROM finance_accounts fa WHERE fa.current_balance < 0), 0)::int AS negative_accounts,
        COALESCE((SELECT SUM(ABS(fa.current_balance)) FROM finance_accounts fa WHERE fa.current_balance < 0), 0)::numeric AS negative_balance_amount
      FROM customer_receipts cr
    `);
    const row = rows[0] ?? {};
    const unappliedReceipts = numberValue(row.unapplied_receipts);
    const unappliedPayments = numberValue(row.unapplied_payments);
    const negativeAccounts = numberValue(row.negative_accounts);
    const negativeBalanceAmount = numberValue(row.negative_balance_amount);
    const exposure = unappliedReceipts + unappliedPayments + negativeBalanceAmount;

    let score = 100;
    score -= Math.min(35, exposure / 50);
    score -= negativeAccounts * 20;

    const signals: string[] = [];
    if (unappliedReceipts > 0) signals.push(`${round2(unappliedReceipts)} EUR unapplied customer receipts`);
    if (unappliedPayments > 0) signals.push(`${round2(unappliedPayments)} EUR unapplied supplier payments`);
    if (negativeAccounts > 0) signals.push(`${negativeAccounts} cash/bank account(s) with negative balance`);
    if (!signals.length) signals.push('No major finance exceptions detected');

    return component('finance', 'Finance Control', score, 0.25, {
      unappliedReceipts: round2(unappliedReceipts),
      unappliedPayments: round2(unappliedPayments),
      negativeAccounts,
      negativeBalanceAmount: round2(negativeBalanceAmount),
      exposure: round2(exposure),
    }, signals);
  }

  private async getCollectionsComponent() {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT
        COUNT(*)::int AS overdue_count,
        COALESCE(SUM(GREATEST(0, si.grand_total - si.amount_paid - COALESCE(r.return_total, 0))), 0)::numeric AS overdue_amount,
        COALESCE(MAX(CURRENT_DATE - si.due_date), 0)::int AS max_days_overdue
      FROM sales_invoices si
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
    `);
    const row = rows[0] ?? {};
    const overdueCount = numberValue(row.overdue_count);
    const overdueAmount = numberValue(row.overdue_amount);
    const maxDaysOverdue = numberValue(row.max_days_overdue);

    let score = 100;
    score -= Math.min(40, overdueAmount / 50);
    score -= Math.min(30, overdueCount * 5);
    score -= Math.min(20, maxDaysOverdue / 3);

    const signals = overdueCount > 0
      ? [`${overdueCount} overdue customer invoice(s)`, `${round2(overdueAmount)} EUR overdue exposure`, `${maxDaysOverdue} max days overdue`]
      : ['No overdue customer invoices detected'];

    return component('collections', 'Collections', score, 0.25, {
      overdueCount,
      overdueAmount: round2(overdueAmount),
      maxDaysOverdue,
    }, signals);
  }

  private async getPayablesComponent() {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT
        COUNT(*)::int AS overdue_count,
        COALESCE(SUM(GREATEST(0, pi.grand_total - pi.amount_paid)), 0)::numeric AS overdue_amount,
        COALESCE(MAX(CURRENT_DATE - pi.due_date), 0)::int AS max_days_overdue
      FROM purchase_invoices pi
      WHERE pi.status = 'POSTED'
        AND pi.due_date IS NOT NULL
        AND pi.due_date < CURRENT_DATE
        AND GREATEST(0, pi.grand_total - pi.amount_paid) > 0
    `);
    const row = rows[0] ?? {};
    const overdueCount = numberValue(row.overdue_count);
    const overdueAmount = numberValue(row.overdue_amount);
    const maxDaysOverdue = numberValue(row.max_days_overdue);

    let score = 100;
    score -= Math.min(35, overdueAmount / 75);
    score -= Math.min(25, overdueCount * 4);
    score -= Math.min(20, maxDaysOverdue / 4);

    const signals = overdueCount > 0
      ? [`${overdueCount} overdue supplier invoice(s)`, `${round2(overdueAmount)} EUR payable overdue`, `${maxDaysOverdue} max days overdue`]
      : ['No overdue supplier invoices detected'];

    return component('payables', 'Payables', score, 0.15, {
      overdueCount,
      overdueAmount: round2(overdueAmount),
      maxDaysOverdue,
    }, signals);
  }

  private async getStockComponent() {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT
        COUNT(*) FILTER (WHERE sb.qty_on_hand <= 5)::int AS low_stock_count,
        COUNT(*) FILTER (WHERE sb.qty_on_hand <= 0)::int AS stockout_count,
        COALESCE(SUM(GREATEST(0, 5 - sb.qty_on_hand)) FILTER (WHERE sb.qty_on_hand <= 5), 0)::numeric AS shortage_qty
      FROM stock_balances sb
    `);
    const row = rows[0] ?? {};
    const lowStockCount = numberValue(row.low_stock_count);
    const stockoutCount = numberValue(row.stockout_count);
    const shortageQty = numberValue(row.shortage_qty);

    let score = 100;
    score -= Math.min(35, lowStockCount * 5);
    score -= Math.min(45, stockoutCount * 15);
    score -= Math.min(20, shortageQty * 2);

    const signals: string[] = [];
    if (lowStockCount > 0) signals.push(`${lowStockCount} low stock balance(s)`);
    if (stockoutCount > 0) signals.push(`${stockoutCount} stockout risk balance(s)`);
    if (shortageQty > 0) signals.push(`${round2(shortageQty)} total shortage quantity vs threshold`);
    if (!signals.length) signals.push('No low stock issues detected');

    return component('stock', 'Stock Health', score, 0.20, {
      lowStockCount,
      stockoutCount,
      shortageQty: round2(shortageQty),
    }, signals);
  }

  private async getWorkflowComponent() {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'SNOOZED'))::int AS active_count,
        COUNT(*) FILTER (WHERE status = 'IN_PROGRESS')::int AS in_progress_count,
        COUNT(*) FILTER (WHERE status = 'SNOOZED')::int AS snoozed_count,
        COUNT(*) FILTER (WHERE status = 'RESOLVED')::int AS resolved_count
      FROM control_tower_exception_states
    `);
    const row = rows[0] ?? {};
    const activeCount = numberValue(row.active_count);
    const inProgressCount = numberValue(row.in_progress_count);
    const snoozedCount = numberValue(row.snoozed_count);
    const resolvedCount = numberValue(row.resolved_count);

    let score = 100;
    score -= Math.min(45, activeCount * 6);
    score += Math.min(10, inProgressCount * 2);
    score += Math.min(10, resolvedCount * 1.5);
    score -= Math.min(10, snoozedCount * 2);

    const signals = [
      `${activeCount} active workflow exception(s)`,
      `${inProgressCount} in progress`,
      `${snoozedCount} snoozed`,
      `${resolvedCount} resolved`,
    ];

    return component('workflow', 'Control Workflow', score, 0.15, {
      activeCount,
      inProgressCount,
      snoozedCount,
      resolvedCount,
    }, signals);
  }
}
