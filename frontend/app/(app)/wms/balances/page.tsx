import { PageHeader } from '@/components/page-header';
import { ServerDataTable } from '@/components/server-data-table';
import { StatusBadge } from '@/components/status-badge';
import { formatQty, locationLabel, WmsSummaryCards } from '@/components/wms/wms-display';
import { api } from '@/lib/api';
import { formatDateOnly } from '@/lib/date';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function WmsBalancesPage() {
  await requirePagePermission(PERMISSIONS.wmsRead);
  const page = await api.listPage<{ items?: any[]; summary?: any }>('wms/balances', { limit: 300 });
  const balances = page.items ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Balancat WMS"
        description="Gjendja sipas lokacionit, lot kodit, skadences, serial number dhe statusit te inventarit."
      />
      <WmsSummaryCards summary={page.summary} />
      <ServerDataTable
        data={balances}
        columns={[
          { key: 'item', title: 'Artikulli', render: (row: any) => `${row.item?.code ?? '-'} - ${row.item?.name ?? '-'}` },
          { key: 'warehouse', title: 'Magazina', render: (row: any) => row.warehouse?.name ?? '-' },
          { key: 'location', title: 'Lokacioni', render: (row: any) => locationLabel(row.location) },
          { key: 'qtyOnHand', title: 'Ne dore', render: (row: any) => formatQty(row.qtyOnHand) },
          {
            key: 'available',
            title: 'E lire',
            render: (row: any) => formatQty(Number(row.qtyOnHand ?? 0) - Number(row.reservedQty ?? 0) - Number(row.pickedQty ?? 0)),
          },
          { key: 'reserved', title: 'Rezervuar', render: (row: any) => formatQty(row.reservedQty) },
          { key: 'picked', title: 'Picked', render: (row: any) => formatQty(row.pickedQty) },
          { key: 'status', title: 'Statusi', render: (row: any) => <StatusBadge value={row.inventoryStatus} /> },
          { key: 'lot', title: 'Lot', render: (row: any) => row.lotCode ?? '-' },
          { key: 'serial', title: 'Serial', render: (row: any) => row.serialNo ?? '-' },
          { key: 'expiry', title: 'Skadenca', render: (row: any) => formatDateOnly(row.expiryDate) },
        ]}
      />
    </div>
  );
}
