import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { api } from '@/lib/api';
import { formatDateOnly } from '@/lib/date';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type JournalEntriesPage = {
  items: Array<{
    id: string;
    entryNo: string;
    entryDate: string;
    description: string;
    sourceType?: string | null;
    sourceNo?: string | null;
    debitTotal: number;
    creditTotal: number;
    createdBy?: { id: string; fullName: string; email?: string | null } | null;
    lines: Array<{
      id: string;
      lineNo: number;
      side: string;
      amount: number | string;
      partyName?: string | null;
      description?: string | null;
      account: { id: string; code: string; name: string };
    }>;
  }>;
  summary: {
    count: number;
    visibleCount: number;
    visibleDebitTotal: number;
    visibleCreditTotal: number;
  };
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

export default async function JournalEntriesPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePagePermission(PERMISSIONS.accountingRead);
  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const yearStart = `${new Date().getUTCFullYear()}-01-01`;
  const journalSearch = readParam(params, 'journalSearch');
  const sourceType = readParam(params, 'sourceType');
  const dateFrom = readParam(params, 'dateFrom', yearStart);
  const dateTo = readParam(params, 'dateTo', today);

  const journalEntriesPage = await api.listPage<JournalEntriesPage>('accounting/journal-entries', {
    search: journalSearch,
    sourceType,
    dateFrom,
    dateTo,
    page: 1,
    limit: 20,
    sortBy: 'entryDate',
    sortOrder: 'desc',
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Journal Entries"
        description="Hyrjet kontabel te gjeneruara nga dokumentet dhe journal-et manuale."
        createHref="/financa/libri-kontabel/new"
        createLabel="Journal Manual"
        createPermission={PERMISSIONS.accountingManage}
      />

      <div className="flex flex-wrap gap-2">
        <Link href="/financa/libri-kontabel" className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:text-indigo-900">
          Kthehu te libri kontabel
        </Link>
        <Link href="/raportet/kontabiliteti/trial-balance" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Trial Balance
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard label="Journal entries" value={journalEntriesPage.summary.count} sub={`${journalEntriesPage.summary.visibleCount} ne pamjen aktuale`} />
        <MetricCard label="Debit ne pamje" value={fmtMoney(journalEntriesPage.summary.visibleDebitTotal)} />
        <MetricCard label="Credit ne pamje" value={fmtMoney(journalEntriesPage.summary.visibleCreditTotal)} />
      </div>

      <form className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Filtrat e journal entries</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <input type="text" name="journalSearch" defaultValue={journalSearch} placeholder="Kerko sipas numrit, pershkrimit ose burimit" className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
          <input type="text" name="sourceType" defaultValue={sourceType} placeholder="Shembull: SALES_INVOICE" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input type="date" name="dateFrom" defaultValue={dateFrom} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input type="date" name="dateTo" defaultValue={dateTo} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="mt-4 flex gap-2">
          <button type="submit" className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">Rifresko journal-in</button>
          <Link href="/financa/libri-kontabel/journal" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Reset</Link>
        </div>
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Journal Entries</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {journalEntriesPage.items.map((entry) => (
            <div key={entry.id} className="p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-slate-900">{entry.entryNo}</p>
                    {entry.sourceType ? <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">{entry.sourceType}</span> : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{entry.description}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {formatDateOnly(entry.entryDate)}
                    {entry.sourceNo ? ` | ${entry.sourceNo}` : ''}
                    {entry.createdBy?.fullName ? ` | ${entry.createdBy.fullName}` : ''}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-right">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Debit</p>
                    <p className="text-sm font-semibold text-slate-900">{fmtMoney(entry.debitTotal)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Credit</p>
                    <p className="text-sm font-semibold text-slate-900">{fmtMoney(entry.creditTotal)}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-b bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Linja</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Konto</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Ana</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Shuma</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {entry.lines.map((line) => (
                      <tr key={line.id}>
                        <td className="px-3 py-2 text-slate-600">{line.lineNo}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-900">{line.account.code} - {line.account.name}</div>
                          {line.partyName || line.description ? <div className="mt-0.5 text-xs text-slate-400">{[line.partyName, line.description].filter(Boolean).join(' | ')}</div> : null}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${line.side === 'DEBIT' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-indigo-50 text-indigo-700 ring-indigo-200'}`}>
                            {line.side === 'DEBIT' ? 'Debit' : 'Credit'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-slate-900">{fmtMoney(line.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {journalEntriesPage.items.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-400">Nuk ka journal entries per filtrat e zgjedhur.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
