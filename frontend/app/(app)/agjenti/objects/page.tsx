import { CustomerObjectForm } from '@/components/agent-orders/agent-order-client';
import { PageHeader } from '@/components/page-header';
import { ServerDataTable } from '@/components/server-data-table';
import { StatusBadge } from '@/components/status-badge';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function AgentCustomerObjectsPage() {
  await requirePagePermission(PERMISSIONS.agentOrdersRead);
  const [customers, objects] = await Promise.all([
    api.list('customers'),
    api.list('agent-orders/customer-objects'),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Objektet e Bleresve"
        description="Njesite ku agjenti leshon order per bleresin: dyqan, depo, filiale ose lokacion terreni."
      />
      <CustomerObjectForm customers={customers} />
      <ServerDataTable
        data={objects}
        columns={[
          { key: 'code', title: 'Kodi', render: (row: any) => row.code },
          { key: 'name', title: 'Objekti', render: (row: any) => row.name },
          { key: 'customer', title: 'Bleresi', render: (row: any) => row.customer?.name ?? '-' },
          { key: 'city', title: 'Qyteti', render: (row: any) => row.city ?? '-' },
          { key: 'phone', title: 'Telefoni', render: (row: any) => row.phone ?? '-' },
          { key: 'isActive', title: 'Statusi', render: (row: any) => <StatusBadge value={row.isActive} /> },
        ]}
      />
    </div>
  );
}
