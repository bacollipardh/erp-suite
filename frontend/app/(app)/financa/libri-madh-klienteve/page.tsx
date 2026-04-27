import { PageHeader } from '@/components/page-header';
import { LedgerExportButton } from '@/components/ledger/ledger-export-button';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

type SearchParams = Record<string, string | string[] | undefined>;

type Party = { id: string; name: string; code?: string };

type LedgerLine = {
  sourceType: string;
  sourceId: string;
  sourceNo: string;
  docDate: string;
  dueDate: string | null;
  description: string;
  referenceNo: string | null;
  partyName: string;
  debit: number;
  credit: number;
  outstanding: number;
  paymentStatus: string | null;
  balance: number;
};

type AgingBuckets = {
  current: number;
  days1To30: number;
  days31To60: number;
  days61To90: number;
  days90Plus: number;
  overdueAmount: number;
};

type LedgerResponse = {
  openingBalance: number;
  closingBalance: number;
  totalDebit: number;
  totalCredit: number;
  totalOutstanding: number;
  aging: AgingBuckets;
  lineCount: number;
  lines: LedgerLine[];
};

function value(params: SearchParams, key: string) {
  const raw = params[key];
  return Array.isArray(raw) ? raw[0] : (raw ?? '');
}

function money(amount: number) {
  return new Intl.NumberFormat('sq-XK', { style: 'currency', currency: 'EUR' }).format(
    Number(amount ?? 0),
  );
}

function fmtDate(val?: string | null) {
  if (!val) return '-';
  return new Date(val).toLocaleDateString('sq-XK');
}

function paymentStatusLabel(status: string | null) {
  if (!status) return null;
  const map: Record<string, { label: string; cls: string }> = {
    UNPAID: { label: 'Pa paguar', cls: 'bg-red-100 text-red-700' },
    PARTIALLY_PAID: { label: 'Pjesërisht', cls: 'bg-amber-100 text-amber-700' },
    PAID: { label: 'Paguar', cls: 'bg-emerald-100 text-emerald-700' },
  };
  return map[status] ?? null;
}

function sourceTypeHref(sourceType: string, sourceId: string) {
  if (sourceType === 'sales-invoices') return `/sales-invoices/${sourceId}`;
  if (sourceType === 'sales-returns') return `/sales-returns/${sourceId}`;
  if (sourceType === 'customer-receipts') return `/arketime/${sourceId}`;
  return null;
}

export default async function Page({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  await requirePagePermission(PERMISSIONS.reportsReceivables);
  const params = (await searchParams) ?? {};
  const customerId = value(params, 'customerId');
  const dateFrom = value(params, 'dateFrom');
  const dateTo = value(params, 'dateTo');

  const [customers, ledger] = await Promise.all([
    api.list<Party>('customers', { limit: 500, sortBy: 'name', sortOrder: 'asc' }),
    api.query<LedgerResponse>('statements/customers/ledger', {
      customerId,
      dateFrom,
      dateTo,
      limit: 2000,
    }),
  ]);

  const { aging } = ledger;
  const hasFilters = customerId || dateFrom || dateTo;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Libri i Madh — Klientët"
          description="Të gjitha lëvizjet financiare të klientëve: fatura, kthime, arketime dhe balance."
        />
        <LedgerExportButton type="customer" partyId={customerId} dateFrom={dateFrom} dateTo={dateTo} />
      </div>

      {/* Filter form */}
      <form className="rounded-xl border bg-white p-4 shadow-sm grid gap-3 md:grid-cols-4">
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="font-medium text-slate-700">Klienti</span>
          <select
            name="customerId"
            defaultValue={customerId}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          >
            <option value="">Të gjithë klientët</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code ? `${c.code} — ` : ''}
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">Nga data</span>
          <input
            name="dateFrom"
            type="date"
            defaultValue={dateFrom}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">Deri më</span>
          <input
            name="dateTo"
            type="date"
            defaultValue={dateTo}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </label>
        <div className="md:col-span-4 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            {ledger.lineCount} lëvizje{hasFilters ? ' për filterin e zgjedhur' : ''}
          </p>
          <button
            type="submit"
            className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            Filtro
          </button>
        </div>
      </form>

      {/* Summary cards */}
      <div className="grid gap-3 md:grid-cols-5">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500 mb-1">Saldo Hapëse</div>
          <div className="text-lg font-semibold text-slate-800">{money(ledger.openingBalance)}</div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500 mb-1">Total Debi</div>
          <div className="text-lg font-semibold text-blue-700">{money(ledger.totalDebit)}</div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500 mb-1">Total Kredi</div>
          <div className="text-lg font-semibold text-emerald-700">{money(ledger.totalCredit)}</div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500 mb-1">Saldo Mbyllëse</div>
          <div
            className={`text-lg font-semibold ${ledger.closingBalance >= 0 ? 'text-slate-800' : 'text-red-600'}`}
          >
            {money(ledger.closingBalance)}
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500 mb-1">Pa Arkëtuar</div>
          <div
            className={`text-lg font-semibold ${ledger.totalOutstanding > 0 ? 'text-red-600' : 'text-emerald-700'}`}
          >
            {money(ledger.totalOutstanding)}
          </div>
        </div>
      </div>

      {/* Aging buckets */}
      {ledger.totalOutstanding > 0 && (
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Analiza e Plakjes (Detyrimet e Pashlyera)</h3>
          <div className="grid gap-3 md:grid-cols-5">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center">
              <div className="text-xs text-emerald-600 font-medium mb-1">Aktuale</div>
              <div className="text-base font-bold text-emerald-800">{money(aging.current)}</div>
              <div className="text-xs text-emerald-500 mt-0.5">≤ 0 ditë</div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
              <div className="text-xs text-amber-600 font-medium mb-1">1–30 ditë</div>
              <div className="text-base font-bold text-amber-800">{money(aging.days1To30)}</div>
              <div className="text-xs text-amber-500 mt-0.5">vonë</div>
            </div>
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-center">
              <div className="text-xs text-orange-600 font-medium mb-1">31–60 ditë</div>
              <div className="text-base font-bold text-orange-800">{money(aging.days31To60)}</div>
              <div className="text-xs text-orange-500 mt-0.5">vonë</div>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
              <div className="text-xs text-red-600 font-medium mb-1">61–90 ditë</div>
              <div className="text-base font-bold text-red-800">{money(aging.days61To90)}</div>
              <div className="text-xs text-red-500 mt-0.5">vonë</div>
            </div>
            <div className="rounded-lg border border-red-300 bg-red-100 p-3 text-center">
              <div className="text-xs text-red-700 font-medium mb-1">+90 ditë</div>
              <div className="text-base font-bold text-red-900">{money(aging.days90Plus)}</div>
              <div className="text-xs text-red-600 mt-0.5">kritike</div>
            </div>
          </div>
          {aging.overdueAmount > 0 && (
            <p className="mt-2 text-xs text-red-600 font-medium">
              Totali i vonuar: {money(aging.overdueAmount)}
            </p>
          )}
        </div>
      )}

      {/* Ledger table */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                {[
                  'Data',
                  'Klienti',
                  'Dokumenti',
                  'Tipi',
                  'Ref. Jashtme',
                  'Afati',
                  'Statusi',
                  'Debi',
                  'Kredi',
                  'Pa Arkëtuar',
                  'Balance',
                ].map((title) => (
                  <th
                    key={title}
                    className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap"
                  >
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ledger.lines.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-12 text-center text-slate-400"
                  >
                    Nuk ka lëvizje për filterin e zgjedhur.
                  </td>
                </tr>
              ) : (
                ledger.lines.map((line, idx) => {
                  const href = sourceTypeHref(line.sourceType, line.sourceId);
                  const status = paymentStatusLabel(line.paymentStatus);
                  const isOverdue =
                    line.outstanding > 0 &&
                    line.dueDate &&
                    new Date(line.dueDate) < new Date();

                  return (
                    <tr
                      key={`${line.sourceType}-${line.sourceId}-${idx}`}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                        {fmtDate(line.docDate)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap font-medium text-slate-800 max-w-[180px] truncate">
                        {line.partyName}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {href ? (
                          <a
                            href={href}
                            className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                          >
                            {line.sourceNo}
                          </a>
                        ) : (
                          <span className="font-medium text-slate-900">{line.sourceNo}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                        {line.description}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-500 text-xs">
                        {line.referenceNo ?? '-'}
                      </td>
                      <td
                        className={`px-3 py-2 whitespace-nowrap text-xs ${isOverdue ? 'text-red-600 font-semibold' : 'text-slate-500'}`}
                      >
                        {fmtDate(line.dueDate)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {status ? (
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${status.cls}`}
                          >
                            {status.label}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right font-medium text-blue-700">
                        {line.debit ? money(line.debit) : '-'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right font-medium text-emerald-700">
                        {line.credit ? money(line.credit) : '-'}
                      </td>
                      <td
                        className={`px-3 py-2 whitespace-nowrap text-right text-xs font-medium ${line.outstanding > 0 ? 'text-red-600' : 'text-slate-400'}`}
                      >
                        {line.outstanding > 0 ? money(line.outstanding) : '-'}
                      </td>
                      <td
                        className={`px-3 py-2 whitespace-nowrap text-right font-semibold ${line.balance < 0 ? 'text-red-600' : 'text-slate-900'}`}
                      >
                        {money(line.balance)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {ledger.lines.length > 0 && (
              <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                <tr>
                  <td colSpan={7} className="px-3 py-2.5 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Totali
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold text-blue-700">
                    {money(ledger.totalDebit)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold text-emerald-700">
                    {money(ledger.totalCredit)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold text-red-600">
                    {ledger.totalOutstanding > 0 ? money(ledger.totalOutstanding) : '-'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                    {money(ledger.closingBalance)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
