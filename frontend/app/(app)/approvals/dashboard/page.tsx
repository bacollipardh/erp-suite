import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

type ApprovalRequest = {
  id: string;
  entityType: string;
  entityNo?: string | null;
  action: string;
  title: string;
  amount: number;
  currencyCode: string;
  status: string;
  requestedByName?: string | null;
  requestedAt: string;
  completedAt?: string | null;
};

type DashboardPayload = {
  summary: {
    totalCount: number;
    pendingCount: number;
    approvedCount: number;
    rejectedCount: number;
    cancelledCount: number;
    totalAmount: number;
    pendingAmount: number;
    approvedAmount: number;
    avgResolutionHours: number;
    oldestPendingHours: number;
  };
  byEntity: {
    entityType: string;
    totalCount: number;
    pendingCount: number;
    approvedCount: number;
    rejectedCount: number;
    cancelledCount: number;
    totalAmount: number;
    pendingAmount: number;
  }[];
  byStatus: { status: string; count: number; amount: number }[];
  aging: { lt4h: number; h4to24: number; d1to3: number; over3d: number };
  recentRequests: ApprovalRequest[];
  topPending: ApprovalRequest[];
  recentEvents: {
    id: string;
    action: string;
    note?: string | null;
    createdAt: string;
    createdByName?: string | null;
    requestId: string;
    title: string;
    entityType: string;
    entityNo?: string | null;
    status: string;
  }[];
  generatedAt: string;
};

function money(value: number, currency = 'EUR') {
  return new Intl.NumberFormat('sq-XK', { style: 'currency', currency }).format(Number(value ?? 0));
}

function statusClass(status: string) {
  if (status === 'APPROVED') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (status === 'REJECTED') return 'bg-red-100 text-red-700 border-red-200';
  if (status === 'CANCELLED') return 'bg-slate-100 text-slate-700 border-slate-200';
  return 'bg-amber-100 text-amber-700 border-amber-200';
}

function dt(value: string) {
  return new Date(value).toLocaleString('sq-XK');
}

function hours(value: number) {
  if (value <= 0) return '-';
  if (value < 24) return `${value.toFixed(1)}h`;
  return `${(value / 24).toFixed(1)}d`;
}

export default async function Page() {
  await requirePagePermission(PERMISSIONS.dashboard);
  const data = await api.query<DashboardPayload>('approvals/dashboard');

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <PageHeader title="Approval Audit Dashboard" description="Pamje menaxheriale për aprovime, risk exposure, aging dhe aktivitetin e fundit." />
        <Link href="/approvals" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Approval Inbox</Link>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="text-xs text-slate-500">Total Requests</div><div className="text-2xl font-bold text-slate-900">{data.summary.totalCount}</div></div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="text-xs text-slate-500">Pending</div><div className="text-2xl font-bold text-amber-600">{data.summary.pendingCount}</div><div className="text-xs text-slate-400">{money(data.summary.pendingAmount)}</div></div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="text-xs text-slate-500">Approved</div><div className="text-2xl font-bold text-emerald-600">{data.summary.approvedCount}</div><div className="text-xs text-slate-400">{money(data.summary.approvedAmount)}</div></div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="text-xs text-slate-500">Avg Resolution</div><div className="text-2xl font-bold text-slate-900">{hours(data.summary.avgResolutionHours)}</div></div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="text-xs text-slate-500">Oldest Pending</div><div className="text-2xl font-bold text-orange-600">{hours(data.summary.oldestPendingHours)}</div></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Approval Breakdown by Entity</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                  {['Entity', 'Total', 'Pending', 'Approved', 'Rejected', 'Amount', 'Pending Amount'].map((title) => <th key={title} className="px-3 py-2">{title}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.byEntity.map((entry) => (
                  <tr key={entry.entityType} className="hover:bg-slate-50">
                    <td className="px-3 py-3 font-semibold text-slate-900">{entry.entityType}</td>
                    <td className="px-3 py-3">{entry.totalCount}</td>
                    <td className="px-3 py-3 text-amber-600 font-semibold">{entry.pendingCount}</td>
                    <td className="px-3 py-3 text-emerald-600 font-semibold">{entry.approvedCount}</td>
                    <td className="px-3 py-3 text-red-600 font-semibold">{entry.rejectedCount}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{money(entry.totalAmount)}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{money(entry.pendingAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Pending Aging</h2>
          <div className="mt-4 space-y-3">
            {[
              ['< 4h', data.aging.lt4h],
              ['4h - 24h', data.aging.h4to24],
              ['1d - 3d', data.aging.d1to3],
              ['> 3d', data.aging.over3d],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl bg-slate-50 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">{label}</span>
                  <span className="font-bold text-slate-900">{value}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Top Pending Exposure</h2>
          <div className="mt-4 space-y-3">
            {data.topPending.length === 0 ? <div className="text-sm text-slate-400">No pending exposure.</div> : data.topPending.map((item) => (
              <Link key={item.id} href={`/approvals/${item.id}`} className="block rounded-xl border bg-slate-50 p-3 hover:bg-slate-100">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">{item.title}</div>
                    <div className="text-xs text-slate-500">{item.entityType} · {item.entityNo ?? '-'}</div>
                  </div>
                  <div className="text-right font-semibold text-slate-900">{money(item.amount, item.currencyCode)}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Recent Events</h2>
          <div className="mt-4 max-h-[470px] space-y-3 overflow-auto pr-1">
            {data.recentEvents.map((event) => (
              <Link key={event.id} href={`/approvals/${event.requestId}`} className="block rounded-xl border bg-slate-50 p-3 hover:bg-slate-100">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">{event.action}</div>
                    <div className="text-xs text-slate-500">{event.title}</div>
                    {event.note ? <div className="mt-2 text-sm text-slate-600">{event.note}</div> : null}
                  </div>
                  <div className="whitespace-nowrap text-xs text-slate-400">{dt(event.createdAt)}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Recent Requests</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                {['Status', 'Request', 'Entity', 'Amount', 'Requested By', 'Requested At'].map((title) => <th key={title} className="px-3 py-2">{title}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.recentRequests.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-3 py-3"><span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusClass(item.status)}`}>{item.status}</span></td>
                  <td className="px-3 py-3"><Link href={`/approvals/${item.id}`} className="font-semibold text-indigo-600 hover:text-indigo-800">{item.title}</Link></td>
                  <td className="px-3 py-3">{item.entityType}<div className="text-xs text-slate-400">{item.entityNo ?? '-'}</div></td>
                  <td className="px-3 py-3 whitespace-nowrap font-semibold">{money(item.amount, item.currencyCode)}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{item.requestedByName ?? '-'}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{dt(item.requestedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="text-xs text-slate-500">Generated at: {dt(data.generatedAt)}</div>
    </div>
  );
}
