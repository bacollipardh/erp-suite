import { PageHeader } from '@/components/page-header';
import { ServerDataTable } from '@/components/server-data-table';
import { StatusBadge } from '@/components/status-badge';
import { api } from '@/lib/api';
import { formatDateOnly } from '@/lib/date';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function AgentOrdersPage() {
  const user = await requirePagePermission(PERMISSIONS.agentOrdersRead);
  const docs = await api.list('agent-orders');

  return (
    <div>
      <PageHeader
        title="Agent Orders"
        description="Order-a operacionale nga agjenti per shitje, kthime dhe nderrime para faturimit."
        createHref="/agjenti/orders/new"
        createLabel="Order i Ri"
        createPermission={PERMISSIONS.agentOrdersManage}
      />
      <ServerDataTable
        data={docs}
        detailsBasePath="/agjenti/orders"
        canOpenDetails={hasPermission(user.permissions, PERMISSIONS.agentOrdersRead)}
        columns={[
          { key: 'orderNo', title: 'Nr. Order', render: (row: any) => row.orderNo },
          { key: 'orderType', title: 'Tipi', render: (row: any) => <StatusBadge value={row.orderType} /> },
          { key: 'customer', title: 'Bleresi', render: (row: any) => row.customer?.name ?? '-' },
          { key: 'object', title: 'Objekti', render: (row: any) => row.customerObject?.name ?? '-' },
          { key: 'warehouse', title: 'Magazina', render: (row: any) => row.warehouse?.name ?? '-' },
          { key: 'docDate', title: 'Data', render: (row: any) => formatDateOnly(row.docDate) },
          { key: 'picker', title: 'Picker', render: (row: any) => row.assignedPicker?.fullName ?? '-' },
          { key: 'status', title: 'Statusi', render: (row: any) => <StatusBadge value={row.status} /> },
        ]}
      />
    </div>
  );
}
