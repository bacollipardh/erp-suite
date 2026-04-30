import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { StatsCard } from '@/components/stats-card';
import { StatusBadge } from '@/components/status-badge';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/date';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

function countBy<T>(items: T[], predicate: (item: T) => boolean) {
  return items.filter(predicate).length;
}

function money(value: number | string | null | undefined) {
  return Number(value ?? 0).toLocaleString('sq-AL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default async function MobileOperationsPage() {
  await requirePagePermission(PERMISSIONS.dashboard);

  const [agentOrders, wmsTasks] = await Promise.all([
    api.list<any>('agent-orders', { limit: 150 }),
    api.list<any>('wms/tasks', { limit: 300 }),
  ]);

  const readyOrders = agentOrders.filter((order) => order.status === 'READY_FOR_DOCUMENT');
  const activeOrders = agentOrders.filter((order) =>
    ['SUBMITTED', 'WMS_ASSIGNED', 'PICKING', 'READY_FOR_DOCUMENT'].includes(order.status),
  );
  const blockedTasks = wmsTasks.filter((task) => task.status === 'BLOCKED');
  const shortTasks = wmsTasks.filter((task) => task.status === 'SHORT');
  const openTasks = wmsTasks.filter(
    (task) => !['DONE', 'CANCELLED', 'SHORT'].includes(task.status),
  );
  const assignedTasks = wmsTasks.filter((task) => task.assignedTo || task.assignedToId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mobile Operations"
        description="Kontroll i perbashket per app-in e agjentit, picker workflow, queue operative dhe task-et qe kerkojne vemendje."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatsCard title="Agent Orders Aktive" value={activeOrders.length} href="/agjenti/orders" />
        <StatsCard title="Gati per Fature" value={readyOrders.length} href="/agjenti/orders?status=READY_FOR_DOCUMENT" />
        <StatsCard title="WMS Task Hapura" value={openTasks.length} href="/wms/tasks" />
        <StatsCard title="Task te Bllokuara" value={blockedTasks.length} href="/wms/tasks?status=BLOCKED" />
        <StatsCard title="Task Short" value={shortTasks.length} href="/wms/tasks?status=SHORT" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="space-y-3 xl:col-span-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Agent Orders qe presin veprim</h2>
            <p className="mt-1 text-sm text-slate-500">
              Ketu duken porosite mobile qe jane ne WMS ose gati per dokument financiar.
            </p>
          </div>
          <div className="overflow-hidden rounded border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Klienti</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Totali</th>
                  <th className="px-4 py-3">Krijuar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeOrders.slice(0, 12).map((order) => (
                  <tr key={order.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <Link className="text-blue-700 hover:underline" href={`/agjenti/orders/${order.id}`}>
                        {order.orderNo ?? order.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{order.customer?.name ?? '-'}</td>
                    <td className="px-4 py-3"><StatusBadge value={order.status} /></td>
                    <td className="px-4 py-3 text-slate-700">{money(order.grandTotal)} EUR</td>
                    <td className="px-4 py-3 text-slate-500">{formatDateTime(order.createdAt)}</td>
                  </tr>
                ))}
                {!activeOrders.length ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>
                      Nuk ka agent orders aktive.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Shperndarja WMS</h2>
            <p className="mt-1 text-sm text-slate-500">Ngarkesa e picker-ave dhe exception-et kryesore.</p>
          </div>
          <div className="rounded border border-slate-200 bg-white p-4">
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Me picker te caktuar</dt>
                <dd className="font-semibold text-slate-900">{assignedTasks.length}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Pick task</dt>
                <dd className="font-semibold text-slate-900">{countBy(wmsTasks, (task) => task.taskType === 'PICK')}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Pack task</dt>
                <dd className="font-semibold text-slate-900">{countBy(wmsTasks, (task) => task.taskType === 'PACK')}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Done</dt>
                <dd className="font-semibold text-slate-900">{countBy(wmsTasks, (task) => task.status === 'DONE')}</dd>
              </div>
            </dl>
          </div>
        </section>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Exception Queue</h2>
          <p className="mt-1 text-sm text-slate-500">
            Detyrat BLOCKED dhe SHORT qe duhet t'i shoh supervisor-i para finalizimit.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {[...blockedTasks, ...shortTasks].slice(0, 12).map((task) => (
            <Link
              key={task.id}
              href={`/wms/tasks?search=${encodeURIComponent(task.referenceNo ?? task.id)}`}
              className="rounded border border-slate-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge value={task.status} />
                <StatusBadge value={task.taskType} />
              </div>
              <p className="mt-3 font-medium text-slate-900">{task.referenceNo ?? task.id.slice(0, 8)}</p>
              <p className="mt-1 text-sm text-slate-600">
                {task.item?.code ?? '-'} | {task.item?.name ?? '-'}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Picker: {task.assignedTo?.fullName ?? task.assignedTo?.email ?? 'Pa caktim'}
              </p>
            </Link>
          ))}
          {blockedTasks.length + shortTasks.length === 0 ? (
            <div className="rounded border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 xl:col-span-2">
              Nuk ka exception aktive ne WMS.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
