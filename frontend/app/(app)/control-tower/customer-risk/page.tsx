import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

type SearchParams = Record<string, string | string[] | undefined>;
type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type CustomerRiskItem = {
  customerId: string;
  customerCode: string;
  customerName: string;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  riskScore: number;
  riskLevel: RiskLevel;
  creditLimit: number;
  creditUsagePercent: number;
  invoiceCount: number;
  openInvoiceCount: number;
  overdueInvoiceCount: number;
  outstandingAmount: number;
  overdueAmount: number;
  maxDaysOverdue: number;
  receiptCount: number;
  totalReceipts: number;
  unappliedReceipts: number;
  lastInvoiceDate?: string | null;
  lastReceiptDate?: string | null;
  signals: string[];
};
type CustomerRiskPayload = {
  summary: {
    total: number;
    low: number;
    medium: number;
    high: number;
    critical: number;
    outstandingAmount: number;
    overdueAmount: number;
    unappliedReceipts: number;
  };
  items: CustomerRiskItem[];
  generatedAt: string;
  appliedFilters: { search?: string | null; risk?: RiskLevel | null; limit: number };
};

function value(params: SearchParams, key: string) {
  const raw = params[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

function money(value: number) {
  return new Intl.NumberFormat('sq-XK', { style: 'currency', currency: 'EUR' }).format(Number(value ?? 0));
}

function riskClass(level: RiskLevel) {
  if (level === 'CRITICAL') return 'bg-red-100 text-red-700 border-red-200';
  if (level === 'HIGH') return 'bg-orange-100 text-orange-700 border-orange-200';
  if (level === 'MEDIUM') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-emerald-100 text-emerald-700 border-emerald-200';
}

function scoreClass(score: number) {
  if (score >= 80) return 'text-red-600';
  if (score >= 60) return 'text-orange-600';
  if (score >= 35) return 'text-amber-600';
  return 'text-emerald-600';
}

function dateValue(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('sq-XK') : '-';
}

const risks: RiskLevel[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

export default async function Page({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  await requirePagePermission(PERMISSIONS.dashboard);
  const params = (await searchParams) ?? {};
  const search = value(params, 'search') ?? '';
  const risk = value(params, 'risk') ?? '';
  const limit = value(params, 'limit') ?? '100';
  const data = await api.query<CustomerRiskPayload>('control-tower/customer-risk', { search, risk, limit });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Customer Risk Score"
        description="Score 0-100 per klientet sipas borxhit, vonesave, faturave te hapura, limitit te kreditit dhe arketimeve te paalokuara."
      />

      <form className="grid gap-3 rounded-2xl border bg-white p-4 shadow-sm md:grid-cols-[1fr_220px_120px_auto]">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">Search</span>
          <input name="search" defaultValue={search} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Customer, code, city" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">Risk</span>
          <select name="risk" defaultValue={risk} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">All risks</option>
            {risks.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">Limit</span>
          <input name="limit" defaultValue={limit} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <div className="flex items-end gap-2">
          <button className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Filtro</button>
          <Link href="/control-tower/customer-risk" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Clear</Link>
        </div>
      </form>

      <div className="grid gap-3 md:grid-cols-7">
        <div className="rounded-2xl border bg-white p-4 shadow-sm md:col-span-2">
          <div className="text-xs text-slate-500">Customers</div>
          <div className="text-2xl font-bold text-slate-900">{data.summary.total}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="text-xs text-slate-500">Critical</div><div className="text-2xl font-bold text-red-600">{data.summary.critical}</div></div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="text-xs text-slate-500">High</div><div className="text-2xl font-bold text-orange-600">{data.summary.high}</div></div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="text-xs text-slate-500">Medium</div><div className="text-2xl font-bold text-amber-600">{data.summary.medium}</div></div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="text-xs text-slate-500">Outstanding</div><div className="text-lg font-bold text-slate-900">{money(data.summary.outstandingAmount)}</div></div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="text-xs text-slate-500">Overdue</div><div className="text-lg font-bold text-slate-900">{money(data.summary.overdueAmount)}</div></div>
      </div>

      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div className="border-b bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">Risk Items</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-white">
              <tr>
                {['Risk', 'Customer', 'Outstanding', 'Overdue', 'Open Inv.', 'Days', 'Credit Usage', 'Last Activity', 'Signals'].map((title) => (
                  <th key={title} className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">{title}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400">Nuk ka klientë për këtë filter.</td></tr>
              ) : data.items.map((item) => (
                <tr key={item.customerId} className="hover:bg-slate-50/70">
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className={`text-2xl font-bold ${scoreClass(item.riskScore)}`}>{item.riskScore}</div>
                    <span className={`mt-1 inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${riskClass(item.riskLevel)}`}>{item.riskLevel}</span>
                  </td>
                  <td className="px-3 py-3 min-w-60">
                    <Link href={`/customers/${item.customerId}`} className="font-semibold text-indigo-600 hover:text-indigo-800">{item.customerName}</Link>
                    <div className="text-xs text-slate-500">{item.customerCode}{item.city ? ` · ${item.city}` : ''}</div>
                    <div className="text-xs text-slate-400">{item.phone ?? item.email ?? '-'}</div>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap font-semibold">{money(item.outstandingAmount)}</td>
                  <td className="px-3 py-3 whitespace-nowrap font-semibold text-red-600">{money(item.overdueAmount)}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{item.openInvoiceCount} open<br /><span className="text-xs text-slate-400">{item.overdueInvoiceCount} overdue</span></td>
                  <td className="px-3 py-3 whitespace-nowrap">{item.maxDaysOverdue}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{item.creditLimit > 0 ? `${item.creditUsagePercent.toLocaleString('sq-XK')}%` : '-'}<br /><span className="text-xs text-slate-400">Limit {money(item.creditLimit)}</span></td>
                  <td className="px-3 py-3 whitespace-nowrap"><div>Inv: {dateValue(item.lastInvoiceDate)}</div><div className="text-xs text-slate-400">Pay: {dateValue(item.lastReceiptDate)}</div></td>
                  <td className="px-3 py-3 min-w-72">
                    <div className="flex flex-wrap gap-1">
                      {item.signals.slice(0, 4).map((entry) => (
                        <span key={entry} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{entry}</span>
                      ))}
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
