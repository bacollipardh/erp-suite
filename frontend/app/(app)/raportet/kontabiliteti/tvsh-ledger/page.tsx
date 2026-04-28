import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { api } from '@/lib/api';
import { formatDateOnly } from '@/lib/date';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type VatLedgerResponse = {
  summary: {
    outputTaxableBase: number;
    outputVat: number;
    inputTaxableBase: number;
    inputVat: number;
    netVatPayable: number;
    documentCount: number;
    manualAdjustmentCount: number;
  };
  items: Array<{
    id: string;
    side: 'INPUT' | 'OUTPUT';
    entryKind: string;
    docNo: string;
    docDate: string;
    partyName?: string | null;
    taxableBase: number;
    vatAmount: number;
    sourceNo?: string | null;
    description?: string | null;
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

export default async function VatLedgerPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePagePermission(PERMISSIONS.reportsAccounting);
  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const yearStart = `${new Date().getUTCFullYear()}-01-01`;
  const dateFrom = readParam(params, 'dateFrom', yearStart);
  const dateTo = readParam(params, 'dateTo', today);
  const vatSide = readParam(params, 'vatSide', 'ALL');
  const vatSearch = readParam(params, 'vatSearch');

  const vatLedger = await api.query<VatLedgerResponse>('accounting/vat-ledger', {
    dateFrom,
    dateTo,
    side: vatSide,
    search: vatSearch,
    page: 1,
    limit: 50,
    sortBy: 'docDate',
    sortOrder: 'desc',
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="TVSH Ledger"
        description="Regjistri i TVSH-se nga faturat, kthimet dhe manual VAT adjustments."
      />

      <div className="flex flex-wrap gap-2">
        <Link href="/raportet/kontabiliteti" className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:text-indigo-900">
          Kthehu te raportet kontabel
        </Link>
        <Link href="/financa/tvsh" className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:text-emerald-900">
          Hap TVSH & Taksat
        </Link>
      </div>

      <form className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Filtrat</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-5">
          <input type="date" name="dateFrom" defaultValue={dateFrom} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input type="date" name="dateTo" defaultValue={dateTo} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <select name="vatSide" defaultValue={vatSide} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="ALL">TVSH hyrje + dalje</option>
            <option value="OUTPUT">Vetem TVSH dalje</option>
            <option value="INPUT">Vetem TVSH hyrje</option>
          </select>
          <input type="text" name="vatSearch" defaultValue={vatSearch} placeholder="Kerko dokument ose pale" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <button type="submit" className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Apliko filtrat
          </button>
        </div>
      </form>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard label="Net VAT Payable" value={fmtMoney(vatLedger.summary.netVatPayable)} sub={`${vatLedger.summary.documentCount} regjistrime`} />
        <MetricCard label="Manual Adjustments" value={vatLedger.summary.manualAdjustmentCount} />
        <MetricCard label="Output VAT" value={fmtMoney(vatLedger.summary.outputVat)} sub={fmtMoney(vatLedger.summary.outputTaxableBase)} />
        <MetricCard label="Input VAT" value={fmtMoney(vatLedger.summary.inputVat)} sub={fmtMoney(vatLedger.summary.inputTaxableBase)} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Rreshtat e TVSH Ledger</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Data</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Dokumenti</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Pala</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Ana</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Base</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">VAT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vatLedger.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-slate-600">{formatDateOnly(item.docDate)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{item.docNo}</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <StatusBadge value={item.side} />
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200">{item.entryKind}</span>
                    </div>
                    {item.description ? <div className="mt-1 text-xs text-slate-400">{item.description}{item.sourceNo ? ` | ${item.sourceNo}` : ''}</div> : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{item.partyName ?? '-'}</td>
                  <td className="px-4 py-3"><StatusBadge value={item.side} /></td>
                  <td className="px-4 py-3 text-right text-slate-700">{fmtMoney(item.taxableBase)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">{fmtMoney(item.vatAmount)}</td>
                </tr>
              ))}
              {vatLedger.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">Nuk ka VAT ledger rows per filtrat e zgjedhur.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
