import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { ExceptionActions } from '@/components/control-tower/exception-actions';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

type SearchParams = Record<string, string | string[] | undefined>;
type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
type ExceptionItem = {
  id: string;
  category: string;
  severity: Severity;
  title: string;
  description: string;
  entityType: string;
  entityId: string;
  entityNo?: string | null;
  partyName?: string | null;
  amount: number;
  stockQty: number;
  daysOverdue?: number | null;
  sourceUrl?: string | null;
  createdAt?: string | null;
  workflow?: {
    status?: string | null;
    assignedToName?: string | null;
    snoozedUntil?: string | null;
    lastNote?: string | null;
    resolvedAt?: string | null;
  };
};
type ExceptionPayload = {
  summary: {
    total: number;
    totalAll: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    financialExposureAmount: number;
    stockExceptionQty: number;
    financeCount: number;
    collectionsCount: number;
    payablesCount: number;
    stockCount: number;
    controlCount: number;
    openCount?: number;
    acknowledgedCount?: number;
    inProgressCount?: number;
    snoozedCount?: number;
    resolvedCount?: number;
  };
  items: ExceptionItem[];
  generatedAt: string;
  appliedFilters: { category?: string | null; severity?: string | null; workflowStatus?: string | null };
};

const categories = ['FINANCE', 'COLLECTIONS', 'PAYABLES', 'STOCK', 'CONTROL'];
const severities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const workflowStatuses = ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'SNOOZED', 'RESOLVED'];

function value(params: SearchParams, key: string) {
  const raw = params[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

function money(value: number) {
  return new Intl.NumberFormat('sq-XK', { style: 'currency', currency: 'EUR' }).format(Number(value ?? 0));
}

function severityClass(severity: Severity) {
  if (severity === 'CRITICAL') return 'bg-red-100 text-red-700 border-red-200';
  if (severity === 'HIGH') return 'bg-orange-100 text-orange-700 border-orange-200';
  if (severity === 'MEDIUM') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function categoryClass(category: string) {
  if (category === 'COLLECTIONS') return 'bg-indigo-50 text-indigo-700';
  if (category === 'PAYABLES') return 'bg-purple-50 text-purple-700';
  if (category === 'STOCK') return 'bg-emerald-50 text-emerald-700';
  if (category === 'CONTROL') return 'bg-rose-50 text-rose-700';
  return 'bg-sky-50 text-sky-700';
}

function workflowClass(status?: string | null) {
  if (status === 'RESOLVED') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (status === 'IN_PROGRESS') return 'bg-blue-100 text-blue-700 border-blue-200';
  if (status === 'SNOOZED') return 'bg-violet-100 text-violet-700 border-violet-200';
  if (status === 'ACKNOWLEDGED') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function metricValue(item: ExceptionItem) {
  return item.category === 'STOCK' ? `${Number(item.stockQty ?? 0).toLocaleString('sq-XK')} qty` : money(item.amount);
}

export default async function Page({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  await requirePagePermission(PERMISSIONS.dashboard);
  const params = (await searchParams) ?? {};
  const category = value(params, 'category') ?? '';
  const severity = value(params, 'severity') ?? '';
  const workflowStatus = value(params, 'workflowStatus') ?? '';
  const data = await api.query<ExceptionPayload>('control-tower/exceptions', { category, severity, workflowStatus });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Control Tower — Exception Inbox"
        description="Qendra operative që mbledh problemet reale nga financa, collections, payables dhe stoku."
      />

      <form className="rounded-xl border bg-white p-4 shadow-sm grid gap-3 md:grid-cols-4">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">Category</span>
          <select name="category" defaultValue={category} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">All Categories</option>
            {categories.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">Severity</span>
          <select name="severity" defaultValue={severity} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">All Severities</option>
            {severities.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">Workflow</span>
          <select name="workflowStatus" defaultValue={workflowStatus} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Active Only</option>
            {workflowStatuses.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Filtro</button>
          <Link href="/control-tower/exceptions" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Clear</Link>
        </div>
      </form>

      <div className="grid gap-3 md:grid-cols-6">
        <div className="rounded-xl border bg-white p-4 shadow-sm md:col-span-2">
          <div className="text-xs text-slate-500">Visible / Total Exceptions</div>
          <div className="text-2xl font-bold text-slate-900">{data.summary.total} / {data.summary.totalAll}</div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm"><div className="text-xs text-slate-500">Open</div><div className="text-2xl font-bold text-slate-700">{data.summary.openCount ?? 0}</div></div>
        <div className="rounded-xl border bg-white p-4 shadow-sm"><div className="text-xs text-slate-500">In Progress</div><div className="text-2xl font-bold text-blue-600">{data.summary.inProgressCount ?? 0}</div></div>
        <div className="rounded-xl border bg-white p-4 shadow-sm"><div className="text-xs text-slate-500">Financial Exposure</div><div className="text-lg font-bold text-slate-900">{money(data.summary.financialExposureAmount)}</div></div>
        <div className="rounded-xl border bg-white p-4 shadow-sm"><div className="text-xs text-slate-500">Stock Exception Qty</div><div className="text-lg font-bold text-slate-900">{Number(data.summary.stockExceptionQty ?? 0).toLocaleString('sq-XK')}</div></div>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <Link href="/control-tower/exceptions?category=FINANCE" className="rounded-xl border bg-white p-3 shadow-sm hover:bg-slate-50"><div className="text-xs text-slate-500">Finance</div><div className="text-xl font-semibold">{data.summary.financeCount}</div></Link>
        <Link href="/control-tower/exceptions?category=COLLECTIONS" className="rounded-xl border bg-white p-3 shadow-sm hover:bg-slate-50"><div className="text-xs text-slate-500">Collections</div><div className="text-xl font-semibold">{data.summary.collectionsCount}</div></Link>
        <Link href="/control-tower/exceptions?category=PAYABLES" className="rounded-xl border bg-white p-3 shadow-sm hover:bg-slate-50"><div className="text-xs text-slate-500">Payables</div><div className="text-xl font-semibold">{data.summary.payablesCount}</div></Link>
        <Link href="/control-tower/exceptions?category=STOCK" className="rounded-xl border bg-white p-3 shadow-sm hover:bg-slate-50"><div className="text-xs text-slate-500">Stock</div><div className="text-xl font-semibold">{data.summary.stockCount}</div></Link>
        <Link href="/control-tower/exceptions?category=CONTROL" className="rounded-xl border bg-white p-3 shadow-sm hover:bg-slate-50"><div className="text-xs text-slate-500">Control</div><div className="text-xl font-semibold">{data.summary.controlCount}</div></Link>
      </div>

      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="border-b bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">Exception Items</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-white border-b">
              <tr>
                {['Severity', 'Category', 'Workflow', 'Issue', 'Party / Source', 'Document', 'Metric', 'Days', 'Action'].map((title) => (
                  <th key={title} className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">{title}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400">Nuk ka exceptions aktive për këtë filter.</td></tr>
              ) : data.items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70">
                  <td className="px-3 py-2 whitespace-nowrap"><span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${severityClass(item.severity)}`}>{item.severity}</span></td>
                  <td className="px-3 py-2 whitespace-nowrap"><span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${categoryClass(item.category)}`}>{item.category}</span></td>
                  <td className="px-3 py-2 whitespace-nowrap"><span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${workflowClass(item.workflow?.status)}`}>{item.workflow?.status ?? 'OPEN'}</span></td>
                  <td className="px-3 py-2 min-w-72"><div className="font-medium text-slate-900">{item.title}</div><div className="text-xs text-slate-500">{item.description}</div>{item.workflow?.lastNote ? <div className="mt-1 text-[11px] text-slate-400">Note: {item.workflow.lastNote}</div> : null}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{item.partyName ?? '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap"><div className="font-medium">{item.entityNo ?? '-'}</div><div className="text-xs text-slate-400">{item.entityType}</div></td>
                  <td className="px-3 py-2 whitespace-nowrap">{metricValue(item)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{item.daysOverdue ?? '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex flex-col gap-2">
                      {item.sourceUrl ? <Link className="text-indigo-600 hover:text-indigo-800 font-medium" href={item.sourceUrl}>Open</Link> : null}
                      <ExceptionActions exceptionKey={item.id} status={item.workflow?.status} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-xs text-slate-500">Generated at: {new Date(data.generatedAt).toLocaleString('sq-XK')}</div>
    </div>
  );
}
