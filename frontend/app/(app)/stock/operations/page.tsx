import { DomainActionCard } from '@/components/domain/domain-action-card';
import { PageHeader } from '@/components/page-header';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { requireAnyPagePermission } from '@/lib/server-page-auth';

export default async function StockOperationsPage() {
  const user = await requireAnyPagePermission([PERMISSIONS.stockAdjust, PERMISSIONS.stockTransfer]);
  const canAdjust = hasPermission(user.permissions, PERMISSIONS.stockAdjust);
  const canTransfer = hasPermission(user.permissions, PERMISSIONS.stockTransfer);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Operacionet e Stokut"
        description="Zgjidh nje operacion te vetem per te punuar pa i perzier rregullimet, transferet dhe inventarizimin."
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {canAdjust ? (
          <DomainActionCard
            title="Rregullim Stoku"
            description="Shto ose zbrit sasi per nje artikull ne nje magazine te vetme."
            href="/stock/operations/rregullim"
            badge="Adjustment"
            tone="indigo"
          />
        ) : null}
        {canTransfer ? (
          <DomainActionCard
            title="Transfer Magazinash"
            description="Leviz sasi nga nje magazine burim ne nje magazine destinacion."
            href="/stock/operations/transfer"
            badge="Transfer"
            tone="emerald"
          />
        ) : null}
        {canAdjust ? (
          <DomainActionCard
            title="Inventarizim"
            description="Vendos sasine e numeruar dhe krijo diferencen e stokut ne menyre te kontrolluar."
            href="/stock/operations/inventarizim"
            badge="Count"
            tone="amber"
          />
        ) : null}
      </div>
    </div>
  );
}
