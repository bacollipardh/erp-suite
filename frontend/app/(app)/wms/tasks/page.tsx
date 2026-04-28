import { PageHeader } from '@/components/page-header';
import { ServerDataTable } from '@/components/server-data-table';
import { StatusBadge } from '@/components/status-badge';
import { formatQty, locationLabel } from '@/components/wms/wms-display';
import { WmsTaskActionsClient } from '@/components/wms/wms-forms-client';
import { api } from '@/lib/api';
import { formatDateOnly, formatDateTime } from '@/lib/date';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function WmsTasksPage() {
  const user = await requirePagePermission(PERMISSIONS.wmsRead);
  const canManage = hasPermission(user.permissions, PERMISSIONS.wmsManage);
  const tasks = await api.list('wms/tasks', { limit: 300 });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Detyrat WMS"
        description="Lista e punes ne magazine, nga pranimi dhe putaway deri te picking, count dhe QC."
      />
      <ServerDataTable
        data={tasks}
        columns={[
          { key: 'taskType', title: 'Detyra', render: (row: any) => <StatusBadge value={row.taskType} /> },
          { key: 'status', title: 'Statusi', render: (row: any) => <StatusBadge value={row.status} /> },
          { key: 'item', title: 'Artikulli', render: (row: any) => row.item ? `${row.item.code ?? '-'} - ${row.item.name ?? '-'}` : '-' },
          { key: 'source', title: 'Nga', render: (row: any) => locationLabel(row.sourceLocation) },
          { key: 'destination', title: 'Ne', render: (row: any) => locationLabel(row.destinationLocation) },
          { key: 'qty', title: 'Sasia', render: (row: any) => formatQty(row.qty) },
          { key: 'lot', title: 'Lot', render: (row: any) => row.lotCode ?? '-' },
          { key: 'serial', title: 'Serial', render: (row: any) => row.serialNo ?? '-' },
          { key: 'expiry', title: 'Skadenca', render: (row: any) => formatDateOnly(row.expiryDate) },
          { key: 'priority', title: 'Prioritet', render: (row: any) => row.priority ?? '-' },
          { key: 'reference', title: 'Reference', render: (row: any) => row.referenceNo ?? '-' },
          { key: 'createdAt', title: 'Krijuar', render: (row: any) => formatDateTime(row.createdAt) },
          { key: 'completedAt', title: 'Mbyllur', render: (row: any) => formatDateTime(row.completedAt) },
          {
            key: 'actions',
            title: 'Veprime',
            render: (row: any) => canManage ? <WmsTaskActionsClient taskId={row.id} status={row.status} /> : '-',
          },
        ]}
      />
    </div>
  );
}
