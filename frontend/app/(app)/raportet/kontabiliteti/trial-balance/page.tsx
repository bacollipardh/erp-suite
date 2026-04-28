import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { api } from '@/lib/api';
import { formatDateOnly } from '@/lib/date';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type TrialBalanceResponse = {
  summary: {
    accountCount: number;
    totalPeriodDebit: number;
    totalPeriodCredit: number;
    totalClosingDebit: number;
    totalClosingCredit: number;
  };
  items: Array<{
    accountId: string;
    accountCode: string;
    accountName: string;
    reportSectionLabel: string;
    openingBalance: number;
    periodDebit: number;
    periodCredit: number;
    closingBalance: number;
  }>;
};

function readParam(params: Record<string, string | string[] | undefined>, key: string, fallback = '') {
  const value = params[key];
  return typeof value === 'string' ? value : fallback;
}

function fmtMoney(value: number | string | null | undefined) {
  return `${Number(value ?? 0).toLocaleString('sq-AL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} EUR`;
}

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-400">{sub}</p> : null}
    </div>
  );
}

export default async function TrialBalancePage({ searchParams }: { searchParams: SearchParams }) {
  await requirePagePermission(PERMISSIONS.reportsAccounting);
  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const yearStart = `${new Date().getUTCFullYear()}-01-01`;
  const dateFrom = readParam(params, 'dateFrom', yearStart);
  const asOfDate = readParam(params, 'asOfDate', today);
  const includeZero = readParam(params, 'includeZero') === 'true';

  const trialBalance = await api.query<TrialBalanceResponse>('accounting/trial-balance', {
    dateFrom,
    asOfDate,
    includeZero,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Trial Balance"
        description="Levizjet debit/credit dhe bilancet mbyllese per secilen konto."
      />

      <div className="flex flex-wrap gap-2">
        <Link href="/raportet/kontabiliteti" className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:text-indigo-900">
          Kthehu te raportet kontabel
        </Link>
        <Link href="/financa/libri-kontabel/kontot" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Hap kontot
        </Link>
      </div>

      <form className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Filtrat</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <input type="date" name="dateFrom" defaultValue={dateFrom} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input type="date" name="asOfDate" defaultValue={asOfDate} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">
            <input type="checkbox" name="includeZero" value="true" defaultChecked={includeZero} />
            Perfshi kontot zero
          </label>
          <button type="submit" className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Apliko filtrat
          </button>
        </div>
      </form>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard label="Konto" value={trialBalance.summary.accountCount} sub={`${formatDateOnly(dateFrom)} deri ${formatDateOnly(asOfDate)}`} />
        <MetricCard label="Debit periudhe" value={fmtMoney(trialBalance.summary.totalPeriodDebit)} />
        <MetricCard label="Credit periudhe" value={fmtMoney(trialBalance.summary.totalPeriodCredit)} />
        <MetricCard label="Mbyllja" value={fmtMoney(trialBalance.summary.totalClosingDebit - trialBalance.summary.totalClosingCredit)} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Rreshtat e Trial Balance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Konto</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Hapja</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Debit</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Credit</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Mbyllja</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {trialBalance.items.map((item) => (
                <tr key={item.accountId}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{item.accountCode} - {item.accountName}</div>
                    <div className="text-xs text-slate-400">{item.reportSectionLabel}</div>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">{fmtMoney(item.openingBalance)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{fmtMoney(item.periodDebit)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{fmtMoney(item.periodCredit)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">{fmtMoney(item.closingBalance)}</td>
                </tr>
              ))}
              {trialBalance.items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">Nuk ka rreshta per filtrat e zgjedhur.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
