import Link from 'next/link';
import {
  AgentOrderActions,
  AgentOrderDocumentActions,
} from '@/components/agent-orders/agent-order-client';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { api } from '@/lib/api';
import { formatDateOnly } from '@/lib/date';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

function money(value?: number | string | null) {
  return Number(value ?? 0).toLocaleString('sq-AL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default async function AgentOrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePagePermission(PERMISSIONS.agentOrdersRead);
  const [order, series, paymentMethods] = await Promise.all([
    api.get('agent-orders', id),
    api.list('document-series'),
    api.list('payment-methods'),
  ]);
  const canManage = hasPermission(user.permissions, PERMISSIONS.agentOrdersManage);
  const canAssign = hasPermission(user.permissions, PERMISSIONS.agentOrdersAssign);

  return (
    <div className="space-y-6">
      <PageHeader
        title={order.orderNo}
        description="Rrjedha nga order i agjentit, ne WMS, pastaj ne dokument financiar."
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2">
          <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Tipi</p>
              <div className="mt-1"><StatusBadge value={order.orderType} /></div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Statusi</p>
              <div className="mt-1"><StatusBadge value={order.status} /></div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Data</p>
              <p className="mt-1 font-medium text-slate-900">{formatDateOnly(order.docDate)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Prioriteti</p>
              <p className="mt-1 font-medium text-slate-900">{order.priority}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Bleresi</p>
              <p className="mt-1 font-medium text-slate-900">{order.customer?.name ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Objekti</p>
              <p className="mt-1 font-medium text-slate-900">{order.customerObject?.name ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Magazina</p>
              <p className="mt-1 font-medium text-slate-900">{order.warehouse?.name ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Picker</p>
              <p className="mt-1 font-medium text-slate-900">{order.assignedPicker?.fullName ?? '-'}</p>
            </div>
          </div>
          {order.notes ? <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{order.notes}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {order.sourceSalesInvoice ? (
              <Link className="text-indigo-700 hover:underline" href={`/sales-invoices/${order.sourceSalesInvoice.id}`}>
                Fatura burim: {order.sourceSalesInvoice.docNo}
              </Link>
            ) : null}
            {order.salesInvoice ? (
              <Link className="text-indigo-700 hover:underline" href={`/sales-invoices/${order.salesInvoice.id}`}>
                Fatura: {order.salesInvoice.docNo}
              </Link>
            ) : null}
            {order.salesReturn ? (
              <Link className="text-indigo-700 hover:underline" href={`/sales-returns/${order.salesReturn.id}`}>
                Kthimi: {order.salesReturn.docNo}
              </Link>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          {canManage || canAssign ? <AgentOrderActions order={order} /> : null}
          {canManage ? (
            <AgentOrderDocumentActions
              order={order}
              invoiceSeries={series.filter((entry: any) => entry.documentType === 'SALES_INVOICE')}
              returnSeries={series.filter((entry: any) => entry.documentType === 'SALES_RETURN')}
              paymentMethods={paymentMethods}
            />
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Rreshtat
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-white text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Artikulli</th>
                <th className="px-4 py-3">Burimi</th>
                <th className="px-4 py-3 text-right">Sasia</th>
                <th className="px-4 py-3 text-right">Cmimi</th>
                <th className="px-4 py-3 text-right">TVSH</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {order.lines.map((line: any) => (
                <tr key={line.id}>
                  <td className="px-4 py-3">{line.item?.code ? `${line.item.code} - ` : ''}{line.item?.name ?? line.itemId}</td>
                  <td className="px-4 py-3">{line.salesInvoiceLineId ? `Line ${line.salesInvoiceLine?.lineNo ?? ''}` : '-'}</td>
                  <td className="px-4 py-3 text-right">{Number(line.qty)}</td>
                  <td className="px-4 py-3 text-right">{money(line.unitPrice)}</td>
                  <td className="px-4 py-3 text-right">{money(line.taxPercent)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Detyrat WMS
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-white text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Tipi</th>
                <th className="px-4 py-3">Artikulli</th>
                <th className="px-4 py-3 text-right">Sasia</th>
                <th className="px-4 py-3">Statusi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(order.tasks ?? []).map((task: any) => (
                <tr key={task.id}>
                  <td className="px-4 py-3"><StatusBadge value={task.taskType} /></td>
                  <td className="px-4 py-3">{task.item?.name ?? '-'}</td>
                  <td className="px-4 py-3 text-right">{task.qty ? Number(task.qty) : '-'}</td>
                  <td className="px-4 py-3"><StatusBadge value={task.status} /></td>
                </tr>
              ))}
              {!(order.tasks ?? []).length ? (
                <tr><td className="px-4 py-4 text-slate-500" colSpan={4}>Nuk ka detyra WMS.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
