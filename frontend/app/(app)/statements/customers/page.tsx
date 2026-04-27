import { PageHeader } from '@/components/page-header';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

type SearchParams = Record<string, string | string[] | undefined>;
type Party = { id: string; name: string; code?: string };
type StatementLine = {
  sourceType: string;
  sourceNo: string;
  docDate: string;
  description: string;
  referenceNo?: string | null;
  partyName: string;
  debit: number;
  credit: number;
  balance: number;
};
type StatementResponse = {
  openingBalance: number;
  closingBalance: number;
  totalDebit: number;
  totalCredit: number;
  lineCount: number;
  lines: StatementLine[];
};

function value(params: SearchParams, key: string) {
  const raw = params[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

function money(amount: number) {
  return new Intl.NumberFormat('sq-XK', { style: 'currency', currency: 'EUR' }).format(Number(amount ?? 0));
}

function date(value?: string) {
  return value ? new Date(value).toLocaleDateString('sq-XK') : '-';
}

export default async function Page({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  await requirePagePermission(PERMISSIONS.reportsReceivables);
  const params = (await searchParams) ?? {};
  const customerId = value(params, 'customerId') ?? '';
  const dateFrom = value(params, 'dateFrom') ?? '';
  const dateTo = value(params, 'dateTo') ?? '';

  const [customers, statement] = await Promise.all([
    api.list<Party>('customers', { limit: 500, sortBy: 'name', sortOrder: 'asc' }),
    api.query<StatementResponse>('statements/customers', {
      customerId,
      dateFrom,
      dateTo,
      limit: 1000,
    }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Customer Statement"
        description="Kartela e klientit me fatura, kthime, arketime dhe running balance."
      />

      <form className="rounded-xl border bg-white p-4 shadow-sm grid gap-3 md:grid-cols-4">
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="font-medium text-slate-700">Klienti</span>
          <select name="customerId" defaultValue={customerId} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Te gjithe klientet</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>{customer.code ? `${customer.code} — ` : ''}{customer.name}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">Nga data</span>
          <input name="dateFrom" type="date" defaultValue={dateFrom} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">Deri me</span>
          <input name="dateTo" type="date" defaultValue={dateTo} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <div className="md:col-span-4 flex justify-end">
          <button className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Filtro</button>
        </div>
      </form>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-4 shadow-sm"><div className="text-xs text-slate-500">Opening</div><div className="text-lg font-semibold">{money(statement.openingBalance)}</div></div>
        <div className="rounded-xl border bg-white p-4 shadow-sm"><div className="text-xs text-slate-500">Debit</div><div className="text-lg font-semibold">{money(statement.totalDebit)}</div></div>
        <div className="rounded-xl border bg-white p-4 shadow-sm"><div className="text-xs text-slate-500">Credit</div><div className="text-lg font-semibold">{money(statement.totalCredit)}</div></div>
        <div className="rounded-xl border bg-white p-4 shadow-sm"><div className="text-xs text-slate-500">Closing Balance</div><div className="text-lg font-semibold">{money(statement.closingBalance)}</div></div>
      </div>

      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                {['Data', 'Klienti', 'Dokumenti', 'Tipi', 'Reference', 'Debit', 'Credit', 'Balance'].map((title) => (
                  <th key={title} className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">{title}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {statement.lines.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">Nuk ka levizje per filterin e zgjedhur.</td></tr>
              ) : statement.lines.map((line, index) => (
                <tr key={`${line.sourceType}-${line.sourceNo}-${index}`} className="hover:bg-slate-50/70">
                  <td className="px-3 py-2 whitespace-nowrap">{date(line.docDate)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{line.partyName}</td>
                  <td className="px-3 py-2 font-medium text-slate-900 whitespace-nowrap">{line.sourceNo}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{line.description}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{line.referenceNo ?? '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{line.debit ? money(line.debit) : '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{line.credit ? money(line.credit) : '-'}</td>
                  <td className="px-3 py-2 font-semibold whitespace-nowrap">{money(line.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
