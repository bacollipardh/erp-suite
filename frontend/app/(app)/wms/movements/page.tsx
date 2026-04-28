import { PageHeader } from '@/components/page-header';
import { ServerDataTable } from '@/components/server-data-table';
import { StatusBadge } from '@/components/status-badge';
import { formatQty, locationLabel } from '@/components/wms/wms-display';
import { api } from '@/lib/api';
import { formatDateOnly, formatDateTime } from '@/lib/date';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function WmsMovementsPage() {
  await requirePagePermission(PERMISSIONS.wmsRead);
  const movements = await api.list('wms/movements', { limit: 300 });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Levizjet WMS"
        description="Gjurma operative e pranimeve, rezervimeve, picking, shipping, count dhe levizjeve mes lokacioneve."
      />
      <ServerDataTable
        data={movements}
        columns={[
          { key: 'type', title: 'Tipi', render: (row: any) => <StatusBadge value={row.movementType} /> },
          { key: 'item', title: 'Artikulli', render: (row: any) => `${row.item?.code ?? '-'} - ${row.item?.name ?? '-'}` },
          { key: 'warehouse', title: 'Magazina', render: (row: any) => row.warehouse?.name ?? '-' },
          { key: 'from', title: 'Nga', render: (row: any) => locationLabel(row.fromLocation) },
          { key: 'to', title: 'Ne', render: (row: any) => locationLabel(row.toLocation) },
          { key: 'qty', title: 'Sasia', render: (row: any) => formatQty(row.qty) },
          { key: 'lot', title: 'Lot', render: (row: any) => row.lotCode ?? '-' },
          { key: 'serial', title: 'Serial', render: (row: any) => row.serialNo ?? '-' },
          { key: 'expiry', title: 'Skadenca', render: (row: any) => formatDateOnly(row.expiryDate) },
          { key: 'reference', title: 'Reference', render: (row: any) => row.referenceNo ?? '-' },
          { key: 'createdAt', title: 'Koha', render: (row: any) => formatDateTime(row.createdAt) },
        ]}
      />
    </div>
  );
}
