import { AgentOrderForm } from '@/components/agent-orders/agent-order-client';
import { PageHeader } from '@/components/page-header';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function NewAgentOrderPage() {
  await requirePagePermission(PERMISSIONS.agentOrdersManage);
  const [customers, customerObjects, warehouses, items, returnSources] = await Promise.all([
    api.list('customers'),
    api.list('agent-orders/customer-objects'),
    api.list('warehouses'),
    api.list('items', { limit: 500 }),
    api.list('agent-orders/return-sources', { limit: 200 }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Order i Ri i Agjentit"
        description="Krijo order per bleres/objekt; faturimi ose kthimi krijohet vetem pas WMS."
      />
      <AgentOrderForm
        customers={customers}
        customerObjects={customerObjects}
        warehouses={warehouses}
        items={items}
        returnSources={returnSources}
      />
    </div>
  );
}
