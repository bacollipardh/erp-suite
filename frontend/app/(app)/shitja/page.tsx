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

export default async function SalesHubPage() {
  const user = await requireAnyPagePermission([
    PERMISSIONS.customersRead,
    PERMISSIONS.salesInvoicesRead,
    PERMISSIONS.salesInvoicesManage,
    PERMISSIONS.salesReturnsRead,
    PERMISSIONS.reportsSales,
  ]);

  const summary = hasPermission(user.permissions, PERMISSIONS.dashboard)
    ? await api.getOne('dashboard/summary')
    : null;

  const canCustomers = hasPermission(user.permissions, PERMISSIONS.customersRead);
  const canSalesInvoices = hasPermission(user.permissions, PERMISSIONS.salesInvoicesRead);
  const canSalesManage = hasPermission(user.permissions, PERMISSIONS.salesInvoicesManage);
  const canSalesReturns = hasPermission(user.permissions, PERMISSIONS.salesReturnsRead);
  const canSalesReports = hasPermission(user.permissions, PERMISSIONS.reportsSales);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Qendra e Shitjes</h1>
        <p className="mt-1 text-sm text-slate-500">
          Ketu qendrojne operacionet tregtare: klientet, POS-i, faturat e shitjes,
          kthimet dhe raportimi i performances se shitjes.
        </p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard
          title="Klientet"
          value={summary?.counts?.customers ?? 0}
          href={canCustomers ? '/customers' : undefined}
        />
        <StatsCard
          title="Faturat e Shitjes"
          value={summary?.counts?.salesInvoices ?? 0}
          href={canSalesInvoices ? '/sales-invoices' : undefined}
        />
        <StatsCard
          title="Kthimet e Shitjes"
          value={summary?.counts?.salesReturns ?? 0}
          href={canSalesReturns ? '/sales-returns' : undefined}
        />
        <StatsCard
          title="Shitje te Postuara"
          value={fmtMoney(summary?.totals?.postedSales ?? 0)}
          href={canSalesReports ? '/raportet/shitje' : undefined}
          subtitle={canSalesReports ? 'Kalimi te raportet e shitjes' : 'Totali i shitjeve te postuara'}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {canSalesManage ? (
          <DomainActionCard
            title="Pika e Shitjes"
            description="Regjistro shitje te shpejta ne POS me flow te optimizuar per operatorin."
            href="/agjenti-shitjes"
            badge="Operative"
            tone="indigo"
          />
        ) : null}
        {canSalesInvoices ? (
          <DomainActionCard
            title="Faturat e Shitjes"
            description="Menaxho dokumentet e shitjes, detajet, posting-un dhe gjendjen operative te faturave."
            href="/sales-invoices"
            badge="Dokumente"
            tone="emerald"
          />
        ) : null}
        {canSalesReturns ? (
          <DomainActionCard
            title="Kthimet e Shitjes"
            description="Kontrollo kreditet nga kthimet dhe dokumentet korrigjuese qe prekin shitjen."
            href="/sales-returns"
            badge="Dokumente"
            tone="amber"
          />
        ) : null}
        {canCustomers ? (
          <DomainActionCard
            title="Klientet"
            description="Mbaje bazen e klienteve te organizuar, me kufi kredie dhe kushte te qarta tregtare."
            href="/customers"
            badge="Master Data"
            tone="slate"
          />
        ) : null}
        {canSalesReports ? (
          <DomainActionCard
            title="Raportet e Shitjes"
            description="Analiza e performances tregtare, trendet mujore, top klientet dhe top agjentet."
            href="/raportet/shitje"
            badge="Raportim"
            tone="indigo"
          />
        ) : null}
        {canSalesInvoices ? (
          <DomainActionCard
            title="Historiku i POS"
            description="Rishiko transaksionet e shitjes operative dhe levizjet e fundit nga pika e shitjes."
            href="/agjenti-shitjes/historiku"
            badge="Historik"
            tone="slate"
          />
        ) : null}
      </div>
    </div>
  );
}
