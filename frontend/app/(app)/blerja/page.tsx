import { DomainActionCard } from '@/components/domain/domain-action-card';
import { StatsCard } from '@/components/stats-card';
import { api } from '@/lib/api';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { requireAnyPagePermission } from '@/lib/server-page-auth';

function fmtMoney(value: number | string | null | undefined) {
  return `${Number(value ?? 0).toLocaleString('sq-AL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} EUR`;
}

export default async function PurchaseHubPage() {
  const user = await requireAnyPagePermission([
    PERMISSIONS.suppliersRead,
    PERMISSIONS.purchaseInvoicesRead,
    PERMISSIONS.purchaseInvoicesManage,
  ]);

  const summary = hasPermission(user.permissions, PERMISSIONS.dashboard)
    ? await api.getOne('dashboard/summary')
    : null;

  const canSuppliers = hasPermission(user.permissions, PERMISSIONS.suppliersRead);
  const canPurchaseInvoices = hasPermission(user.permissions, PERMISSIONS.purchaseInvoicesRead);
  const canFinanceHub = hasPermission(user.permissions, [
    PERMISSIONS.reportsPayables,
    PERMISSIONS.purchaseInvoicesPay,
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Qendra e Blerjes</h1>
        <p className="mt-1 text-sm text-slate-500">
          Ketu qendrojne furnitoret dhe dokumentet e blerjes. Pagesat ndaj furnitoreve
          mbahen te ndara te domeni financiar.
        </p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard
          title="Furnitoret"
          value={summary?.counts?.suppliers ?? 0}
          href={canSuppliers ? '/suppliers' : undefined}
        />
        <StatsCard
          title="Faturat e Blerjes"
          value={summary?.counts?.purchaseInvoices ?? 0}
          href={canPurchaseInvoices ? '/purchase-invoices' : undefined}
        />
        <StatsCard
          title="Blerje te Postuara"
          value={fmtMoney(summary?.totals?.postedPurchases ?? 0)}
          href={canPurchaseInvoices ? '/purchase-invoices' : undefined}
        />
        <StatsCard
          title="Detyrime Financiare"
          value={fmtMoney(summary?.outstanding?.payables ?? 0)}
          href={canFinanceHub ? '/financa' : undefined}
          subtitle={
            canFinanceHub
              ? 'Pagesat dhe due dates menaxhohen te Financa'
              : 'Vlera financiare e lidhur me faturat e blerjes'
          }
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {canPurchaseInvoices ? (
          <DomainActionCard
            title="Faturat e Blerjes"
            description="Kontrollo dokumentet hyrese, posting-un, due dates dhe rrjedhen operative te blerjes."
            href="/purchase-invoices"
            badge="Dokumente"
            tone="indigo"
          />
        ) : null}
        {canSuppliers ? (
          <DomainActionCard
            title="Furnitoret"
            description="Organizo subjektet furnizuese, kushtet e pageses dhe te dhenat baze te marredhenieve te blerjes."
            href="/suppliers"
            badge="Master Data"
            tone="emerald"
          />
        ) : null}
        {canFinanceHub ? (
          <DomainActionCard
            title="Kalimi te Financa"
            description="Pagesat e furnitoreve, rialokimet dhe aging i detyrimeve jane ndare ne domenin financiar."
            href="/financa"
            badge="Cross-domain"
            tone="amber"
          />
        ) : null}
      </div>
    </div>
  );
}
