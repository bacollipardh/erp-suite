import { DomainActionCard } from '@/components/domain/domain-action-card';
import { PageHeader } from '@/components/page-header';
import { StatsCard } from '@/components/stats-card';
import { api } from '@/lib/api';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

function fmtMoney(value: number | string | null | undefined) {
  return `${Number(value ?? 0).toLocaleString('sq-AL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} EUR`;
}

export default async function DashboardPage() {
  const user = await requirePagePermission(PERMISSIONS.dashboard);
  const summary = await api.getOne('dashboard/summary');

  const canSalesHub = hasPermission(user.permissions, [
    PERMISSIONS.customersRead,
    PERMISSIONS.salesInvoicesRead,
    PERMISSIONS.salesInvoicesManage,
    PERMISSIONS.salesReturnsRead,
    PERMISSIONS.reportsSales,
  ]);
  const canPurchaseHub = hasPermission(user.permissions, [
    PERMISSIONS.suppliersRead,
    PERMISSIONS.purchaseInvoicesRead,
    PERMISSIONS.purchaseInvoicesManage,
  ]);
  const canFinanceHub = hasPermission(user.permissions, [
    PERMISSIONS.reportsReceivables,
    PERMISSIONS.reportsPayables,
    PERMISSIONS.salesInvoicesPay,
    PERMISSIONS.purchaseInvoicesPay,
    PERMISSIONS.financeAccountsRead,
  ]);
  const canStockHub = hasPermission(user.permissions, [
    PERMISSIONS.itemsRead,
    PERMISSIONS.warehousesRead,
    PERMISSIONS.stockRead,
    PERMISSIONS.stockAdjust,
  ]);
  const canApprovals = hasPermission(user.permissions, PERMISSIONS.dashboard);
  const canControlTower = hasPermission(user.permissions, PERMISSIONS.dashboard);
  const canReports = hasPermission(user.permissions, [
    PERMISSIONS.reportsSales,
    PERMISSIONS.reportsReceivables,
    PERMISSIONS.reportsPayables,
    PERMISSIONS.reportsAccounting,
    PERMISSIONS.stockRead,
  ]);

  const totalCritical =
    Number(summary.critical?.receivables?.overdueCount ?? 0) +
    Number(summary.critical?.receivables?.dueTodayCount ?? 0) +
    Number(summary.critical?.payables?.overdueCount ?? 0) +
    Number(summary.critical?.payables?.dueTodayCount ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pasqyra e Pergjithshme"
        description="Pamje e shkurter me KPI dhe hyrje te qarta drejt faqeve te ndara operative."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          title="Shitje te Postuara"
          value={fmtMoney(summary.totals?.postedSales ?? 0)}
          href={canSalesHub ? '/shitja' : undefined}
        />
        <StatsCard
          title="Blerje te Postuara"
          value={fmtMoney(summary.totals?.postedPurchases ?? 0)}
          href={canPurchaseHub ? '/blerja' : undefined}
        />
        <StatsCard
          title="Arketime te Hapura"
          value={fmtMoney(summary.outstanding?.receivables ?? 0)}
          href={canFinanceHub ? '/arketime' : undefined}
        />
        <StatsCard
          title="Detyrime te Hapura"
          value={fmtMoney(summary.outstanding?.payables ?? 0)}
          href={canFinanceHub ? '/pagesat' : undefined}
        />
        <StatsCard
          title="Cashflow Mujor"
          value={fmtMoney(
            Number(summary.cashflow?.receiptsMonth ?? 0) -
              Number(summary.cashflow?.paymentsMonth ?? 0),
          )}
          subtitle="Neto"
          href={canFinanceHub ? '/financa' : undefined}
        />
        <StatsCard
          title="Dokumente Kritike"
          value={totalCritical}
          subtitle="Overdue ose due today"
          href={canFinanceHub ? '/financa/kontrolli-mujor' : undefined}
        />
        <StatsCard
          title="Artikuj"
          value={summary.counts?.items ?? 0}
          href={canStockHub ? '/items' : undefined}
        />
        <StatsCard
          title="Linjat e Stokut"
          value={summary.counts?.stockLines ?? 0}
          href={canStockHub ? '/stock/balances' : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        {canSalesHub ? (
          <DomainActionCard
            title="Shitja"
            description="Klientet, POS-i, faturat e shitjes, kthimet dhe raportimi tregtar."
            href="/shitja"
            badge="Domain"
            tone="indigo"
          />
        ) : null}
        {canPurchaseHub ? (
          <DomainActionCard
            title="Blerja"
            description="Furnitoret dhe dokumentet e blerjes, te ndara nga pagesat dhe aging-u."
            href="/blerja"
            badge="Domain"
            tone="emerald"
          />
        ) : null}
        {canFinanceHub ? (
          <DomainActionCard
            title="Financa"
            description="Arketimet, pagesat, rialokimet, cash/bank dhe kontrolli mujor."
            href="/financa"
            badge="Domain"
            tone="amber"
          />
        ) : null}
        {canStockHub ? (
          <DomainActionCard
            title="Artikuj & Stoku"
            description="Artikujt, magazinat, balancat dhe operacionet e stokut."
            href="/stoku"
            badge="Domain"
            tone="slate"
          />
        ) : null}
        {canReports ? (
          <DomainActionCard
            title="Raportet"
            description="Raportet e ndara per shitje, financa, kontabilitet dhe stok."
            href="/raportet"
            badge="Reports"
            tone="indigo"
          />
        ) : null}
        {canApprovals ? (
          <DomainActionCard
            title="Aprovimet"
            description="Inbox, policies, dashboard dhe krijimi i approval requests."
            href="/approvals"
            badge="Workflow"
            tone="emerald"
          />
        ) : null}
        {canControlTower ? (
          <DomainActionCard
            title="Control Tower"
            description="Exceptions, company pulse, customer risk dhe supplier risk."
            href="/control-tower/exceptions"
            badge="Control"
            tone="amber"
          />
        ) : null}
      </div>
    </div>
  );
}
