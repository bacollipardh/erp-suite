import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { ApprovalActions } from '@/components/approvals/approval-actions';
import { CreateApprovalRequestForm } from '@/components/approvals/create-approval-request-form';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

type SearchParams = Record<string, string | string[] | undefined>;
type ApprovalRequest = {
  id: string;
  entityType: string;
  entityNo?: string | null;
  action: string;
  title: string;
  description?: string | null;
  amount: number;
  currencyCode: string;
  status: string;
  currentStep: number;
  requiredSteps: number;
  policyName?: string | null;
  requestedByName?: string | null;
  requestedAt: string;
  ageHours?: number;
  isOverdue?: boolean;
  slaHours?: number;
};
type ApprovalPayload = { items: ApprovalRequest[]; total: number; summary: { total: number; pending: number; approved: number; rejected: number; cancelled: number } };
type BadgePayload = { pendingAll: number; pendingForMe: number; overdueAll: number; slaHours: number };

function value(params: SearchParams, key: string) { const raw = params[key]; return Array.isArray(raw) ? raw[0] : raw; }
function money(value: number, currency = 'EUR') { return new Intl.NumberFormat('sq-XK', { style: 'currency', currency }).format(Number(value ?? 0)); }
function statusClass(status: string) { if (status === 'APPROVED') return 'bg-emerald-100 text-emerald-700 border-emerald-200'; if (status === 'REJECTED') return 'bg-red-100 text-red-700 border-red-200'; if (status === 'CANCELLED') return 'bg-slate-100 text-slate-700 border-slate-200'; return 'bg-amber-100 text-amber-700 border-amber-200'; }
function hours(value?: number) { if (!value) return '-'; if (value < 24) return `${value.toFixed(1)}h`; return `${(value / 24).toFixed(1)}d`; }

export default async function Page({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  await requirePagePermission(PERMISSIONS.dashboard);
  const params = (await searchParams) ?? {};
  const status = value(params, 'status') ?? '';
  const search = value(params, 'search') ?? '';
  const scope = value(params, 'scope') ?? '';
  const [data, badge] = await Promise.all([
    api.query<ApprovalPayload>('approvals/requests', { status, search, scope, limit: 100 }),
    api.query<BadgePayload>('approvals/badge'),
  ]);

  const scopeLink = (nextScope: string) => `/approvals?scope=${encodeURIComponent(nextScope)}${status ? `&status=${encodeURIComponent(status)}` : ''}${search ? `&search=${encodeURIComponent(search)}` : ''}`;

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <PageHeader title="Approval Inbox" description="Qendra e aprovimeve me kontroll role/user, SLA dhe self-approval prevention." />
      <CreateApprovalRequestForm />
    </div>

    <div className="grid gap-3 md:grid-cols-3">
      <Link href={scopeLink('for_me')} className={`rounded-2xl border p-4 shadow-sm ${scope === 'for_me' || scope === 'my_approvals' ? 'bg-indigo-50 border-indigo-200' : 'bg-white hover:bg-slate-50'}`}>
        <div className="text-xs text-slate-500">Pending for me</div><div className="text-2xl font-bold text-indigo-700">{badge.pendingForMe}</div>
      </Link>
      <Link href="/approvals?status=PENDING" className="rounded-2xl border bg-white p-4 shadow-sm hover:bg-slate-50">
        <div className="text-xs text-slate-500">Pending all</div><div className="text-2xl font-bold text-amber-600">{badge.pendingAll}</div>
      </Link>
      <Link href="/approvals?status=PENDING" className="rounded-2xl border bg-white p-4 shadow-sm hover:bg-slate-50">
        <div className="text-xs text-slate-500">Overdue &gt; {badge.slaHours}h</div><div className="text-2xl font-bold text-red-600">{badge.overdueAll}</div>
      </Link>
    </div>

    <form className="grid gap-3 rounded-2xl border bg-white p-4 shadow-sm md:grid-cols-[180px_220px_1fr_auto]">
      <label className="space-y-1 text-sm"><span className="font-medium text-slate-700">Scope</span><select name="scope" defaultValue={scope} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">All</option><option value="for_me">My Approvals</option><option value="mine">Created by me</option></select></label>
      <label className="space-y-1 text-sm"><span className="font-medium text-slate-700">Status</span><select name="status" defaultValue={status} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">All</option><option value="PENDING">PENDING</option><option value="APPROVED">APPROVED</option><option value="REJECTED">REJECTED</option><option value="CANCELLED">CANCELLED</option></select></label>
      <label className="space-y-1 text-sm"><span className="font-medium text-slate-700">Search</span><input name="search" defaultValue={search} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Title, entity no, entity type" /></label>
      <div className="flex items-end gap-2"><button className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Filtro</button><Link href="/approvals" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Clear</Link></div>
    </form>

    <div className="grid gap-3 md:grid-cols-5">
      <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="text-xs text-slate-500">Total</div><div className="text-2xl font-bold">{data.summary.total}</div></div>
      <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="text-xs text-slate-500">Pending</div><div className="text-2xl font-bold text-amber-600">{data.summary.pending}</div></div>
      <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="text-xs text-slate-500">Approved</div><div className="text-2xl font-bold text-emerald-600">{data.summary.approved}</div></div>
      <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="text-xs text-slate-500">Rejected</div><div className="text-2xl font-bold text-red-600">{data.summary.rejected}</div></div>
      <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="text-xs text-slate-500">Cancelled</div><div className="text-2xl font-bold text-slate-600">{data.summary.cancelled}</div></div>
    </div>

    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="border-b bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">Requests</div>
      <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="border-b bg-white"><tr>{['Status', 'Request', 'Entity', 'Amount', 'Step', 'SLA', 'Requested By', 'Requested At', 'Actions'].map((title) => <th key={title} className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">{title}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">
        {data.items.length === 0 ? <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400">Nuk ka approval requests për këtë filter.</td></tr> : data.items.map((item) => <tr key={item.id} className="hover:bg-slate-50/70">
          <td className="px-3 py-3 whitespace-nowrap"><span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusClass(item.status)}`}>{item.status}</span></td>
          <td className="px-3 py-3 min-w-72"><Link href={`/approvals/${item.id}`} className="font-semibold text-indigo-600 hover:text-indigo-800">{item.title}</Link><div className="text-xs text-slate-500">{item.description ?? item.policyName ?? '-'}</div></td>
          <td className="px-3 py-3 whitespace-nowrap"><div>{item.entityType}</div><div className="text-xs text-slate-400">{item.entityNo ?? '-'}</div></td>
          <td className="px-3 py-3 whitespace-nowrap font-semibold">{money(item.amount, item.currencyCode)}</td>
          <td className="px-3 py-3 whitespace-nowrap">{item.currentStep} / {item.requiredSteps}</td>
          <td className="px-3 py-3 whitespace-nowrap"><span className={item.isOverdue ? 'font-semibold text-red-600' : 'text-slate-600'}>{hours(item.ageHours)}</span></td>
          <td className="px-3 py-3 whitespace-nowrap">{item.requestedByName ?? '-'}</td>
          <td className="px-3 py-3 whitespace-nowrap">{new Date(item.requestedAt).toLocaleString('sq-XK')}</td>
          <td className="px-3 py-3 whitespace-nowrap"><ApprovalActions id={item.id} status={item.status} /></td>
        </tr>)}
      </tbody></table></div>
    </div>
  </div>;
}
