import { PageHeader } from '@/components/page-header';
import { ServerDataTable } from '@/components/server-data-table';
import { StatusBadge } from '@/components/status-badge';
import { WmsLocationForm } from '@/components/wms/wms-forms-client';
import { api } from '@/lib/api';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { requireAnyPagePermission } from '@/lib/server-page-auth';

export default async function WmsLocationsPage() {
  const user = await requireAnyPagePermission([PERMISSIONS.wmsRead, PERMISSIONS.wmsManage]);
  const canRead = hasPermission(user.permissions, PERMISSIONS.wmsRead);
  const canManage = hasPermission(user.permissions, PERMISSIONS.wmsManage);

  const [locations, warehouses] = await Promise.all([
    canRead ? api.list('wms/locations', { limit: 500 }) : Promise.resolve([]),
    canManage ? api.list('warehouses', { limit: 500 }) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Lokacionet WMS"
        description="Cdo lokacion fizik eshte i ndare ne zone, aisle, rack, shelf dhe bin."
      />

      {canManage ? (
        <WmsLocationForm warehouses={warehouses.filter((warehouse: any) => warehouse.isActive !== false)} />
      ) : null}

      {canRead ? (
        <ServerDataTable
          data={locations}
          columns={[
            { key: 'code', title: 'Kodi', render: (row: any) => row.code },
            { key: 'warehouse', title: 'Magazina', render: (row: any) => row.warehouse?.name ?? '-' },
            { key: 'barcode', title: 'Barcode', render: (row: any) => row.barcode ?? '-' },
            { key: 'zone', title: 'Zone', render: (row: any) => row.zone },
            { key: 'aisle', title: 'Aisle', render: (row: any) => row.aisle ?? '-' },
            { key: 'rack', title: 'Rack', render: (row: any) => row.rack ?? '-' },
            { key: 'shelf', title: 'Shelf', render: (row: any) => row.shelf ?? '-' },
            { key: 'bin', title: 'Bin', render: (row: any) => row.bin ?? '-' },
            { key: 'type', title: 'Tipi', render: (row: any) => <StatusBadge value={row.locationType} /> },
            { key: 'status', title: 'Statusi', render: (row: any) => <StatusBadge value={row.status} /> },
          ]}
        />
      ) : null}
    </div>
  );
}
