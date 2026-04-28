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

export default async function ProfitLossPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePagePermission(PERMISSIONS.reportsAccounting);
  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const yearStart = `${new Date().getUTCFullYear()}-01-01`;
  const dateFrom = readParam(params, 'dateFrom', yearStart);
  const dateTo = readParam(params, 'dateTo', today);
  const includeZero = readParam(params, 'includeZero') === 'true';

  const report = await api.query<StatementResponse>('accounting/profit-loss', {
    dateFrom,
    dateTo,
    includeZero,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Fitim-Humbje"
        description="Pasqyra e te ardhurave, shpenzimeve dhe rezultatit neto."
      />

      <div className="flex flex-wrap gap-2">
        <Link href="/raportet/kontabiliteti" className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:text-indigo-900">
          Kthehu te raportet kontabel
        </Link>
      </div>

      <form className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Filtrat</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <input type="date" name="dateFrom" defaultValue={dateFrom} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input type="date" name="dateTo" defaultValue={dateTo} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">
            <input type="checkbox" name="includeZero" value="true" defaultChecked={includeZero} />
            Perfshi kontot zero
          </label>
          <button type="submit" className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Apliko filtrat
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Rezultati neto</p>
        <p className="mt-1 text-3xl font-bold text-slate-900">{fmtMoney(report.summary.netProfit ?? 0)}</p>
        <p className="mt-1 text-sm text-slate-500">{formatDateOnly(dateFrom)} deri {formatDateOnly(dateTo)}</p>
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
