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

export default async function FinanceHubPage() {
  const user = await requireAnyPagePermission([
    PERMISSIONS.reportsReceivables,
    PERMISSIONS.reportsPayables,
    PERMISSIONS.salesInvoicesPay,
    PERMISSIONS.purchaseInvoicesPay,
  ]);

  const summary = hasPermission(user.permissions, PERMISSIONS.dashboard)
    ? await api.getOne('dashboard/summary')
    : null;

  const canReceivables = hasPermission(user.permissions, PERMISSIONS.reportsReceivables);
  const canPayables = hasPermission(user.permissions, PERMISSIONS.reportsPayables);
  const canReceiptReallocation = hasPermission(user.permissions, PERMISSIONS.salesInvoicesPay);
  const canPaymentReallocation = hasPermission(user.permissions, PERMISSIONS.purchaseInvoicesPay);
  const canFinanceReports = hasPermission(user.permissions, [
    PERMISSIONS.reportsReceivables,
    PERMISSIONS.reportsPayables,
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Qendra e Financave</h1>
        <p className="mt-1 text-sm text-slate-500">
          Arketimet, pagesat, rialokimet, aging dhe exposure jane te ndara qarte nga
          shitja dhe blerja qe perdoruesi te punoje sipas rolit financiar.
        </p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard
          title="Arketime te Hapura"
          value={fmtMoney(summary?.outstanding?.receivables ?? 0)}
          href={canReceivables ? '/arketime' : undefined}
        />
        <StatsCard
          title="Detyrime te Hapura"
          value={fmtMoney(summary?.outstanding?.payables ?? 0)}
          href={canPayables ? '/pagesat' : undefined}
        />
        <StatsCard
          title="Arketime Kete Muaj"
          value={fmtMoney(summary?.cashflow?.receiptsMonth ?? 0)}
          href={canReceivables ? '/arketime' : undefined}
        />
        <StatsCard
          title="Pagesa Kete Muaj"
          value={fmtMoney(summary?.cashflow?.paymentsMonth ?? 0)}
          href={canPayables ? '/pagesat' : undefined}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {canReceivables ? (
          <DomainActionCard
            title="Arketimet"
            description="Menaxho pagesat hyrese te klienteve, filtrat, due states dhe lidhjet me faturat e shitjes."
            href="/arketime"
            badge="Receivables"
            tone="indigo"
          />
        ) : null}
        {canReceiptReallocation ? (
          <DomainActionCard
            title="Rialokimi i Arketimeve"
            description="Apliko balance `unapplied` te klienteve te dokumente te tjera konkrete me audit trail te plote."
            href="/arketime/rialokime"
            badge="Receivables"
            tone="emerald"
          />
        ) : null}
        {canPayables ? (
          <DomainActionCard
            title="Pagesat"
            description="Menaxho pagesat ndaj furnitoreve, aktivitetin e fundit dhe gjendjen pas cdo disbursimi."
            href="/pagesat"
            badge="Payables"
            tone="indigo"
          />
        ) : null}
        {canPaymentReallocation ? (
          <DomainActionCard
            title="Rialokimi i Pagesave"
            description="Ri-apliko tepricat e pagesave te furnitoreve te dokumente te tjera me ledger dhe audit trail."
            href="/pagesat/rialokime"
            badge="Payables"
            tone="amber"
          />
        ) : null}
        {canFinanceReports ? (
          <DomainActionCard
            title="Raportet Financiare"
            description="Shiko aging, exposure, receivables dhe payables ne nje raportim te ndare nga shitja."
            href="/raportet/financa"
            badge="Raportim"
            tone="slate"
          />
        ) : null}
      </div>
    </div>
  );
}
