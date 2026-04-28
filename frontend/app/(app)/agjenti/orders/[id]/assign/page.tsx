import { AgentOrderAssignForm } from '@/components/agent-orders/agent-order-client';
import { PageHeader } from '@/components/page-header';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function AssignAgentOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePagePermission(PERMISSIONS.agentOrdersAssign);
  const [order, pickers] = await Promise.all([
    api.get('agent-orders', id),
    api.list('agent-orders/pickers'),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Cakto Picker / Receiver" description="Lidhe order-in me personin qe do ta kryeje WMS." />
      <AgentOrderAssignForm order={order} pickers={pickers} />
    </div>
  );
}
