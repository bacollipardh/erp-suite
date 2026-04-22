import { DomainActionCard } from '@/components/domain/domain-action-card';
import { StatsCard } from '@/components/stats-card';
import { api } from '@/lib/api';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function StockReportsPage() {
  const user = await requirePagePermission(PERMISSIONS.stockRead);

  const [summary, warehouses] = await Promise.all([
    hasPermission(user.permissions, PERMISSIONS.dashboard)
      ? api.getOne('dashboard/summary')
      : Promise.resolve(null),
    hasPermission(user.permissions, PERMISSIONS.warehousesRead)
      ? api.list('warehouses', { limit: 200 })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Raportet e Stokut</h1>
        <p className="mt-1 text-sm text-slate-500">
          Kjo faqe e vendos stokun dhe materialet si domain te trete te raportimit,
          te ndare nga shitja dhe financa.
        </p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard title="Artikujt" value={summary?.counts?.items ?? 0} href="/items" />
        <StatsCard title="Magazinat" value={warehouses.length} href="/warehouses" />
        <StatsCard
          title="Linjat e Stokut"
          value={summary?.counts?.stockLines ?? 0}
          href="/stock/balances"
        />
        <StatsCard title="Qendra e Stokut" value="Hap" href="/stoku" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <DomainActionCard
          title="Gjendja e Stokut"
          description="Pamja kryesore e balancave materiale sipas magazines dhe artikullit."
          href="/stock/balances"
          badge="Balance"
          tone="indigo"
        />
        <DomainActionCard
          title="Levizjet e Stokut"
          description="Gjurmimi i hyrjeve dhe daljeve materiale me renditje kronologjike."
          href="/stock/movements"
          badge="Movements"
          tone="emerald"
        />
        <DomainActionCard
          title="Operacione Stoku"
          description="Qasje e shpejte te adjustments, transfers dhe counting si pjese e reporting-ut material."
          href="/stock/operations"
          badge="Operations"
          tone="amber"
        />
      </div>
    </div>
  );
}
