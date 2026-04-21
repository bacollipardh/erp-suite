import { StatsCard } from '@/components/stats-card';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

function fmtMoney(value: number) {
  return `${value.toLocaleString('sq-AL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} EUR`;
}

export default async function DashboardPage() {
  await requirePagePermission(PERMISSIONS.dashboard);
  const summary = await api.getOne('dashboard/summary');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Ballina</h1>
        <p className="text-sm text-slate-500 mt-1">Pamje e pergjithshme e sistemit.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard title="Artikujt" value={summary.counts.items} />
        <StatsCard title="Furnitoret" value={summary.counts.suppliers} />
        <StatsCard title="Klientet" value={summary.counts.customers} />
        <StatsCard title="Linjat e Stokut" value={summary.counts.stockLines} />
        <StatsCard title="Faturat e Blerjes" value={summary.counts.purchaseInvoices} />
        <StatsCard title="Faturat e Shitjes" value={summary.counts.salesInvoices} />
        <StatsCard title="Kthimet e Shitjes" value={summary.counts.salesReturns} />
        <StatsCard
          title="Arketime te Hapura"
          value={fmtMoney(Number(summary.outstanding.receivables ?? 0))}
        />
        <StatsCard
          title="Detyrime te Hapura"
          value={fmtMoney(Number(summary.outstanding.payables ?? 0))}
        />
        <StatsCard title="Shitje te Postuara" value={fmtMoney(Number(summary.totals.postedSales ?? 0))} />
        <StatsCard
          title="Blerje te Postuara"
          value={fmtMoney(Number(summary.totals.postedPurchases ?? 0))}
        />
        <StatsCard
          title="Kthime te Postuara"
          value={fmtMoney(Number(summary.totals.postedReturns ?? 0))}
        />
      </div>
    </div>
  );
}
