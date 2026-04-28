import { PageHeader } from '@/components/page-header';
import { ServerDataTable } from '@/components/server-data-table';
import { StatusBadge } from '@/components/status-badge';
import { formatQty, locationLabel } from '@/components/wms/wms-display';
import { api } from '@/lib/api';
import { formatDateOnly, formatDateTime } from '@/lib/date';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function WmsReservationsPage() {
  await requirePagePermission(PERMISSIONS.wmsRead);
  const reservations = await api.list('wms/reservations', { limit: 300 });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Rezervimet WMS"
        description="Rezervimet e krijuara nga picking, me status, lokacion, lot, skadence dhe serial number."
      />
      <ServerDataTable
        data={reservations}
        columns={[
          { key: 'invoice', title: 'Fatura', render: (row: any) => row.salesInvoice?.docNo ?? '-' },
          { key: 'customer', title: 'Klienti', render: (row: any) => row.salesInvoice?.customer?.name ?? '-' },
          { key: 'item', title: 'Artikulli', render: (row: any) => `${row.item?.code ?? '-'} - ${row.item?.name ?? '-'}` },
          { key: 'location', title: 'Lokacioni', render: (row: any) => locationLabel(row.location) },
          { key: 'reserved', title: 'Rezervuar', render: (row: any) => formatQty(row.qtyReserved) },
          { key: 'picked', title: 'Picked', render: (row: any) => formatQty(row.qtyPicked) },
          { key: 'status', title: 'Statusi', render: (row: any) => <StatusBadge value={row.status} /> },
          { key: 'lot', title: 'Lot', render: (row: any) => row.lotCode ?? '-' },
          { key: 'serial', title: 'Serial', render: (row: any) => row.serialNo ?? '-' },
          { key: 'expiry', title: 'Skadenca', render: (row: any) => formatDateOnly(row.expiryDate) },
          { key: 'createdAt', title: 'Krijuar', render: (row: any) => formatDateTime(row.createdAt) },
        ]}
      />
    </div>
  );
}
