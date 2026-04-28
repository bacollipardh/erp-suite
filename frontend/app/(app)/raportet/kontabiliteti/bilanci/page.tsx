import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { api } from '@/lib/api';
import { formatDateOnly } from '@/lib/date';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type StatementResponse = {
  summary: Record<string, number>;
  sections: Array<{
    section: string;
    label: string;
    total: number;
    items: Array<{
      accountId: string;
      accountCode: string;
      accountName: string;
      amount: number;
      debit: number;
      credit: number;
    }>;
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

export default async function BalanceSheetPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePagePermission(PERMISSIONS.reportsAccounting);
  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const asOfDate = readParam(params, 'asOfDate', today);
  const includeZero = readParam(params, 'includeZero') === 'true';

  const report = await api.query<StatementResponse>('accounting/balance-sheet', {
    asOfDate,
    includeZero,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bilanci"
        description="Aktivet, detyrimet dhe kapitali ne daten e zgjedhur."
      />

      <div className="flex flex-wrap gap-2">
        <Link href="/raportet/kontabiliteti" className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:text-indigo-900">
          Kthehu te raportet kontabel
        </Link>
      </div>

      <form className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Filtrat</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total Assets</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{fmtMoney(report.summary.totalAssets ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Liabilities + Equity</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{fmtMoney(report.summary.totalLiabilitiesAndEquity ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Diferenca</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{fmtMoney(report.summary.difference ?? 0)}</p>
          <p className="mt-1 text-xs text-slate-400">As of {formatDateOnly(asOfDate)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {report.sections.map((section) => (
          <div key={section.section} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-slate-900">{section.label}</h2>
                <span className="text-sm font-semibold text-slate-900">{fmtMoney(section.total)}</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Konto</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Debit</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Credit</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Shuma</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {section.items.map((item) => (
                    <tr key={item.accountId}>
                      <td className="px-4 py-3 text-slate-700">{item.accountCode} - {item.accountName}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{fmtMoney(item.debit)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{fmtMoney(item.credit)}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">{fmtMoney(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
