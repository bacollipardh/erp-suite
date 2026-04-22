import { DomainActionCard } from '@/components/domain/domain-action-card';
import { StatsCard } from '@/components/stats-card';
import { api } from '@/lib/api';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { requireAnyPagePermission } from '@/lib/server-page-auth';

export default async function StockHubPage() {
  const user = await requireAnyPagePermission([
    PERMISSIONS.itemsRead,
    PERMISSIONS.warehousesRead,
    PERMISSIONS.stockRead,
    PERMISSIONS.stockAdjust,
  ]);

  const [summary, warehouses] = await Promise.all([
    hasPermission(user.permissions, PERMISSIONS.dashboard)
      ? api.getOne('dashboard/summary')
      : Promise.resolve(null),
    hasPermission(user.permissions, PERMISSIONS.warehousesRead)
      ? api.list('warehouses', { limit: 200 })
      : Promise.resolve([]),
  ]);

  const canItems = hasPermission(user.permissions, PERMISSIONS.itemsRead);
  const canWarehouses = hasPermission(user.permissions, PERMISSIONS.warehousesRead);
  const canStockRead = hasPermission(user.permissions, PERMISSIONS.stockRead);
  const canStockAdjust = hasPermission(user.permissions, PERMISSIONS.stockAdjust);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Qendra e Stokut</h1>
        <p className="mt-1 text-sm text-slate-500">
          Artikujt, magazinat dhe levizjet materiale jane grupuar ne nje domen me vete,
          te ndara nga financa dhe dokumentet tregtare.
        </p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard
          title="Artikujt"
          value={summary?.counts?.items ?? 0}
          href={canItems ? '/items' : undefined}
        />
        <StatsCard
          title="Magazinat"
          value={warehouses.length}
          href={canWarehouses ? '/warehouses' : undefined}
        />
        <StatsCard
          title="Linjat e Stokut"
          value={summary?.counts?.stockLines ?? 0}
          href={canStockRead ? '/stock/balances' : undefined}
        />
        <StatsCard
          title="Raportet e Stokut"
          value="Hap"
          href={canStockRead ? '/raportet/stoku' : undefined}
          subtitle={canStockRead ? 'Qasje te raportet materiale' : 'Raportimi i stokut sipas lejeve'}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {canItems ? (
          <DomainActionCard
            title="Artikujt"
            description="Ruaj katalogun e artikujve, kategorite, njesite dhe parametrat baze te materialeve."
            href="/items"
            badge="Master Data"
            tone="indigo"
          />
        ) : null}
        {canStockRead ? (
          <DomainActionCard
            title="Gjendja e Stokut"
            description="Shiko balancat aktuale sipas artikullit dhe magazines pa kaluar neper dokumentet tregtare."
            href="/stock/balances"
            badge="Raportim"
            tone="emerald"
          />
        ) : null}
        {canStockRead ? (
          <DomainActionCard
            title="Levizjet e Stokut"
            description="Kontrollo hyrjet, daljet dhe gjurmen materiale ne nje vend te centralizuar."
            href="/stock/movements"
            badge="Operative"
            tone="amber"
          />
        ) : null}
        {canStockAdjust ? (
          <DomainActionCard
            title="Operacione Stoku"
            description="Bej rregullime, transfere dhe stock counts pa i perzier me financat apo shitjen."
            href="/stock/operations"
            badge="Operative"
            tone="slate"
          />
        ) : null}
        {canStockRead ? (
          <DomainActionCard
            title="Raportet e Stokut"
            description="Nis ndarjen e raporteve te stokut dhe materialeve si domain i trete i raportimit."
            href="/raportet/stoku"
            badge="Raportim"
            tone="indigo"
          />
        ) : null}
      </div>
    </div>
  );
}
