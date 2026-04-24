import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

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
  daysOverdue?: number | null;
  sourceUrl?: string | null;
  createdAt?: string | null;
};
type ExceptionPayload = {
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    exposureAmount: number;
    financeCount: number;
    collectionsCount: number;
    payablesCount: number;
    stockCount: number;
    controlCount: number;
  };
  items: ExceptionItem[];
  generatedAt: string;
};

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

export default async function Page() {
  await requirePagePermission(PERMISSIONS.dashboard);
  const data = await api.query<ExceptionPayload>('control-tower/exceptions');

  return (
    <div className="space-y-5">
      <PageHeader
        title="Control Tower — Exception Inbox"
        description="Qendra operative që mbledh problemet reale nga financa, collections, payables dhe stoku."
      />

      <div className="grid gap-3 md:grid-cols-6">
        <div className="rounded-xl border bg-white p-4 shadow-sm md:col-span-2">
          <div className="text-xs text-slate-500">Total Exceptions</div>
          <div className="text-2xl font-bold text-slate-900">{data.summary.total}</div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500">Critical</div>
          <div className="text-2xl font-bold text-red-600">{data.summary.critical}</div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500">High</div>
          <div className="text-2xl font-bold text-orange-600">{data.summary.high}</div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500">Medium</div>
          <div className="text-2xl font-bold text-amber-600">{data.summary.medium}</div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500">Exposure</div>
          <div className="text-lg font-bold text-slate-900">{money(data.summary.exposureAmount)}</div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <div className="rounded-xl border bg-white p-3 shadow-sm"><div className="text-xs text-slate-500">Finance</div><div className="text-xl font-semibold">{data.summary.financeCount}</div></div>
        <div className="rounded-xl border bg-white p-3 shadow-sm"><div className="text-xs text-slate-500">Collections</div><div className="text-xl font-semibold">{data.summary.collectionsCount}</div></div>
        <div className="rounded-xl border bg-white p-3 shadow-sm"><div className="text-xs text-slate-500">Payables</div><div className="text-xl font-semibold">{data.summary.payablesCount}</div></div>
        <div className="rounded-xl border bg-white p-3 shadow-sm"><div className="text-xs text-slate-500">Stock</div><div className="text-xl font-semibold">{data.summary.stockCount}</div></div>
        <div className="rounded-xl border bg-white p-3 shadow-sm"><div className="text-xs text-slate-500">Control</div><div className="text-xl font-semibold">{data.summary.controlCount}</div></div>
      </div>

      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="border-b bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
          Exception Items
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-white border-b">
              <tr>
                {['Severity', 'Category', 'Issue', 'Party / Source', 'Document', 'Amount', 'Days', 'Action'].map((title) => (
                  <th key={title} className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">{title}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">Nuk ka exceptions aktive. Gjendja duket e pastër.</td></tr>
              ) : data.items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70">
                  <td className="px-3 py-2 whitespace-nowrap"><span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${severityClass(item.severity)}`}>{item.severity}</span></td>
                  <td className="px-3 py-2 whitespace-nowrap"><span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${categoryClass(item.category)}`}>{item.category}</span></td>
                  <td className="px-3 py-2 min-w-72"><div className="font-medium text-slate-900">{item.title}</div><div className="text-xs text-slate-500">{item.description}</div></td>
                  <td className="px-3 py-2 whitespace-nowrap">{item.partyName ?? '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap"><div className="font-medium">{item.entityNo ?? '-'}</div><div className="text-xs text-slate-400">{item.entityType}</div></td>
                  <td className="px-3 py-2 whitespace-nowrap">{item.amount ? money(item.amount) : '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{item.daysOverdue ?? '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {item.sourceUrl ? <Link className="text-indigo-600 hover:text-indigo-800 font-medium" href={item.sourceUrl}>Open</Link> : '-'}
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
