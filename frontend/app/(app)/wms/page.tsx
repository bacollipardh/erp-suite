import { DomainActionCard } from '@/components/domain/domain-action-card';
import { PageHeader } from '@/components/page-header';
import { WmsSummaryCards } from '@/components/wms/wms-display';
import { api } from '@/lib/api';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { requireAnyPagePermission } from '@/lib/server-page-auth';

const WMS_PERMISSIONS = [
  PERMISSIONS.wmsRead,
  PERMISSIONS.wmsManage,
  PERMISSIONS.wmsReceive,
  PERMISSIONS.wmsMove,
  PERMISSIONS.wmsPick,
  PERMISSIONS.wmsCount,
];

export default async function WmsHubPage() {
  const user = await requireAnyPagePermission(WMS_PERMISSIONS);
  const canRead = hasPermission(user.permissions, PERMISSIONS.wmsRead);
  const canManage = hasPermission(user.permissions, PERMISSIONS.wmsManage);
  const canReceive = hasPermission(user.permissions, PERMISSIONS.wmsReceive);
  const canMove = hasPermission(user.permissions, PERMISSIONS.wmsMove);
  const canPick = hasPermission(user.permissions, PERMISSIONS.wmsPick);
  const canCount = hasPermission(user.permissions, PERMISSIONS.wmsCount);

  const balances = canRead
    ? await api.listPage<{ summary?: any }>('wms/balances', { limit: 1 })
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Qendra WMS"
        description="Lokacione, barcode, lot/skadence/serial number, pranime, levizje, picking dhe bllokim i shitjes para konfirmimit."
      />

      {canRead ? <WmsSummaryCards summary={balances?.summary} /> : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {canRead ? (
          <DomainActionCard
            title="Lokacionet WMS"
            description="Zone, aisle, rack, shelf dhe bin per cdo magazine me status dhe barcode."
            href="/wms/locations"
            badge="Master Data"
            tone="indigo"
          />
        ) : null}
        {canRead ? (
          <DomainActionCard
            title="Balancat WMS"
            description="Sasia ne dore, e rezervuar, picked, lot kodi, skadenca dhe serial numbers."
            href="/wms/balances"
            badge="Gjendje"
            tone="emerald"
          />
        ) : null}
        {canRead ? (
          <DomainActionCard
            title="Detyrat WMS"
            description="Pick, receive, move, count dhe detyrat operative me status te ndare."
            href="/wms/tasks"
            badge="Task"
            tone="amber"
          />
        ) : null}
        {canReceive ? (
          <DomainActionCard
            title="Pranim Malli"
            description="Regjistro hyrje ne lokacion me lot kod, skadence dhe serial numbers."
            href="/wms/receiving"
            badge="Inbound"
            tone="emerald"
          />
        ) : null}
        {canMove ? (
          <DomainActionCard
            title="Levizje Bin-to-Bin"
            description="Leviz sasi ose serial number nga nje lokacion WMS ne tjetrin."
            href="/wms/move"
            badge="Move"
            tone="indigo"
          />
        ) : null}
        {canCount ? (
          <DomainActionCard
            title="Inventarizim WMS"
            description="Numero lokacionin dhe ruaj diferencen si gjurme WMS."
            href="/wms/counts"
            badge="Count"
            tone="slate"
          />
        ) : null}
        {canManage ? (
          <DomainActionCard
            title="QC dhe Bllokim"
            description="Vendos stokun ne quarantine, damaged ose expired qe te mos shitet."
            href="/wms/qc"
            badge="Quality"
            tone="amber"
          />
        ) : null}
        {canPick ? (
          <DomainActionCard
            title="Picking Shitje"
            description="Planifiko, konfirmo ose liro picking per faturat draft te shitjes."
            href="/wms/picking"
            badge="Outbound"
            tone="emerald"
          />
        ) : null}
        {canRead ? (
          <DomainActionCard
            title="Scanner"
            description="Kerko me barcode, kod artikulli, lokacion, lot ose serial number."
            href="/wms/scanner"
            badge="Scan"
            tone="slate"
          />
        ) : null}
      </div>
    </div>
  );
}
