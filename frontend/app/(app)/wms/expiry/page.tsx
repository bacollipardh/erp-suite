import { PageHeader } from '@/components/page-header';
import { ServerDataTable } from '@/components/server-data-table';
import { StatsCard } from '@/components/stats-card';
import { StatusBadge } from '@/components/status-badge';
import { formatQty, locationLabel } from '@/components/wms/wms-display';
import { WmsExpiryActions } from '@/components/wms/wms-forms-client';
import { api } from '@/lib/api';
import { formatDateOnly } from '@/lib/date';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function WmsExpiryPage() {
  const user = await requirePagePermission(PERMISSIONS.wmsRead);
  const page = await api.listPage<{ items?: any[]; summary?: any }>('wms/expiry', { limit: 300, days: 60 });
  const items = page.items ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Skadencat WMS"
        description="Stoku qe ka skaduar ose skadon se shpejti, per bllokim para shitjes."
      />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatsCard title="Rreshta" value={page.summary?.rows ?? 0} subtitle="Brenda 60 diteve" />
        <StatsCard title="Sasia" value={formatQty(page.summary?.qtyOnHand)} subtitle="Ne dore" />
        <StatsCard title="Rezervuar" value={formatQty(page.summary?.reservedQty)} />
        <StatsCard title="Picked" value={formatQty(page.summary?.pickedQty)} />
      </div>
      {hasPermission(user.permissions, PERMISSIONS.wmsManage) ? <WmsExpiryActions /> : null}
      <ServerDataTable
        data={items}
        columns={[
          { key: 'item', title: 'Artikulli', render: (row: any) => `${row.item?.code ?? '-'} - ${row.item?.name ?? '-'}` },
          { key: 'warehouse', title: 'Magazina', render: (row: any) => row.warehouse?.name ?? '-' },
          { key: 'location', title: 'Lokacioni', render: (row: any) => locationLabel(row.location) },
          { key: 'qty', title: 'Sasia', render: (row: any) => formatQty(row.qtyOnHand) },
          { key: 'status', title: 'Statusi', render: (row: any) => <StatusBadge value={row.inventoryStatus} /> },
          { key: 'lot', title: 'Lot', render: (row: any) => row.lotCode ?? '-' },
          { key: 'serial', title: 'Serial', render: (row: any) => row.serialNo ?? '-' },
          { key: 'expiry', title: 'Skadenca', render: (row: any) => formatDateOnly(row.expiryDate) },
        ]}
      />
    </div>
  );
}
