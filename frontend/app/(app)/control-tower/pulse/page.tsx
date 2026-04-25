import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

type PulseStatus = 'EXCELLENT' | 'GOOD' | 'WATCH' | 'RISK' | 'CRITICAL';
type PulseComponent = {
  key: string;
  label: string;
  score: number;
  status: PulseStatus;
  weight: number;
  metrics: Record<string, number>;
  signals: string[];
};
type PulsePayload = {
  score: number;
  status: PulseStatus;
  components: PulseComponent[];
  generatedAt: string;
  interpretation: string;
};

function statusClass(status: PulseStatus) {
  if (status === 'EXCELLENT') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (status === 'GOOD') return 'bg-blue-100 text-blue-700 border-blue-200';
  if (status === 'WATCH') return 'bg-amber-100 text-amber-700 border-amber-200';
  if (status === 'RISK') return 'bg-orange-100 text-orange-700 border-orange-200';
  return 'bg-red-100 text-red-700 border-red-200';
}

function scoreTextClass(score: number) {
  if (score >= 90) return 'text-emerald-600';
  if (score >= 75) return 'text-blue-600';
  if (score >= 55) return 'text-amber-600';
  if (score >= 35) return 'text-orange-600';
  return 'text-red-600';
}

function metricLabel(key: string) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (char) => char.toUpperCase());
}

function metricValue(value: number) {
  return Number.isInteger(value) ? value.toLocaleString('sq-XK') : value.toLocaleString('sq-XK', { maximumFractionDigits: 2 });
}

function drilldownFor(key: string) {
  switch (key) {
    case 'finance':
      return { href: '/financa/llogarite', label: 'View Finance Accounts' };
    case 'collections':
      return { href: '/control-tower/customer-risk', label: 'View Customer Risk' };
    case 'payables':
      return { href: '/control-tower/supplier-risk', label: 'View Supplier Risk' };
    case 'stock':
      return { href: '/stock/balances', label: 'View Stock Balances' };
    case 'workflow':
      return { href: '/control-tower/exceptions', label: 'View Exception Inbox' };
    default:
      return { href: '/control-tower/exceptions', label: 'View Details' };
  }
}

export default async function Page() {
  await requirePagePermission(PERMISSIONS.dashboard);
  const pulse = await api.query<PulsePayload>('control-tower/pulse');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company Pulse"
        description="Indeksi 0-100 per shendetin operativ te kompanise nga finance, collections, payables, stock dhe workflow."
      />

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <div className="flex flex-col items-center justify-center rounded-2xl border bg-slate-50 p-6 text-center">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Overall Pulse</div>
            <div className={`mt-3 text-7xl font-bold ${scoreTextClass(pulse.score)}`}>{pulse.score}</div>
            <div className="mt-3 text-sm text-slate-500">out of 100</div>
            <span className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(pulse.status)}`}>
              {pulse.status}
            </span>
          </div>

          <div className="flex flex-col justify-between gap-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Management Interpretation</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{pulse.interpretation}</p>
            </div>

            <div className="grid gap-3 md:grid-cols-5">
              <Link href="/control-tower/exceptions" className="rounded-xl border bg-white p-4 shadow-sm hover:bg-slate-50">
                <div className="text-xs text-slate-500">Exceptions</div>
                <div className="mt-1 text-sm font-semibold text-indigo-600">Control Tower</div>
              </Link>
              <Link href="/control-tower/customer-risk" className="rounded-xl border bg-white p-4 shadow-sm hover:bg-slate-50">
                <div className="text-xs text-slate-500">Receivables</div>
                <div className="mt-1 text-sm font-semibold text-indigo-600">Customer Risk</div>
              </Link>
              <Link href="/control-tower/supplier-risk" className="rounded-xl border bg-white p-4 shadow-sm hover:bg-slate-50">
                <div className="text-xs text-slate-500">Payables</div>
                <div className="mt-1 text-sm font-semibold text-indigo-600">Supplier Risk</div>
              </Link>
              <Link href="/financa/llogarite" className="rounded-xl border bg-white p-4 shadow-sm hover:bg-slate-50">
                <div className="text-xs text-slate-500">Cash / Bank</div>
                <div className="mt-1 text-sm font-semibold text-indigo-600">Accounts</div>
              </Link>
              <Link href="/stock/balances" className="rounded-xl border bg-white p-4 shadow-sm hover:bg-slate-50">
                <div className="text-xs text-slate-500">Stock</div>
                <div className="mt-1 text-sm font-semibold text-indigo-600">Balances</div>
              </Link>
            </div>

            <div className="text-xs text-slate-500">Generated at: {new Date(pulse.generatedAt).toLocaleString('sq-XK')}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {pulse.components.map((item) => {
          const drilldown = drilldownFor(item.key);
          return (
            <section key={item.key} className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{item.label}</h3>
                  <div className="mt-1 text-xs text-slate-500">Weight: {(item.weight * 100).toFixed(0)}%</div>
                </div>
                <div className="text-right">
                  <div className={`text-3xl font-bold ${scoreTextClass(item.score)}`}>{item.score}</div>
                  <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(item.status)}`}>
                    {item.status}
                  </span>
                </div>
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {Object.entries(item.metrics).map(([key, value]) => (
                  <div key={key} className="rounded-xl border bg-slate-50 px-3 py-2">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{metricLabel(key)}</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">{metricValue(value)}</div>
                  </div>
                ))}
              </div>

              <div className="mt-5 space-y-2">
                {item.signals.map((signal) => (
                  <div key={signal} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    {signal}
                  </div>
                ))}
              </div>

              <div className="mt-5 flex justify-end">
                <Link href={drilldown.href} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                  {drilldown.label}
                </Link>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
