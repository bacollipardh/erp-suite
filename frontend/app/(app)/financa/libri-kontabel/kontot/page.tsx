import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type LedgerAccountsPage = {
  items: Array<{
    id: string;
    code: string;
    name: string;
    category: string;
    reportSectionLabel: string;
    isActive: boolean;
    isSystem: boolean;
    allowManual: boolean;
    balance: number;
    debitTotal: number;
    creditTotal: number;
    financeAccounts?: Array<{ id: string; code: string; name: string; accountType: string }>;
  }>;
  summary: {
    accountCount: number;
    activeCount: number;
    inactiveCount: number;
  };
};

const CATEGORY_OPTIONS = [
  { value: '', label: 'Te gjitha kategorite' },
  { value: 'ASSET', label: 'Aktive' },
  { value: 'LIABILITY', label: 'Detyrime' },
  { value: 'EQUITY', label: 'Kapital' },
  { value: 'REVENUE', label: 'Te ardhura' },
  { value: 'CONTRA_REVENUE', label: 'Kunder te ardhurave' },
  { value: 'EXPENSE', label: 'Shpenzime' },
];

const REPORT_SECTION_OPTIONS = [
  { value: '', label: 'Te gjitha seksionet' },
  { value: 'CURRENT_ASSET', label: 'Aktive afatshkurtra' },
  { value: 'NON_CURRENT_ASSET', label: 'Aktive afatgjata' },
  { value: 'CURRENT_LIABILITY', label: 'Detyrime afatshkurtra' },
  { value: 'NON_CURRENT_LIABILITY', label: 'Detyrime afatgjata' },
  { value: 'EQUITY', label: 'Kapital' },
  { value: 'REVENUE', label: 'Te ardhura' },
  { value: 'CONTRA_REVENUE', label: 'Kunder te ardhurave' },
  { value: 'COST_OF_SALES', label: 'Kosto e shitjeve' },
  { value: 'OPERATING_EXPENSE', label: 'Shpenzime operative' },
  { value: 'OTHER_INCOME', label: 'Te ardhura te tjera' },
  { value: 'OTHER_EXPENSE', label: 'Shpenzime te tjera' },
];

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

export default async function LedgerAccountsPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePagePermission(PERMISSIONS.accountingRead);
  const params = await searchParams;
  const accountSearch = readParam(params, 'accountSearch');
  const category = readParam(params, 'category');
  const reportSection = readParam(params, 'reportSection');

  const accountsPage = await api.listPage<LedgerAccountsPage>('accounting/accounts', {
    search: accountSearch,
    category,
    reportSection,
    page: 1,
    limit: 50,
    sortBy: 'code',
    sortOrder: 'asc',
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Kontot Kontabel"
        description="Chart of accounts, statusi i kontove dhe bilanci aktual per secilen konto."
      />

      <div className="flex flex-wrap gap-2">
        <Link href="/financa/libri-kontabel" className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:text-indigo-900">
          Kthehu te libri kontabel
        </Link>
        <Link href="/financa/llogarite" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Llogarite cash / bank
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard label="Konto aktive" value={accountsPage.summary.activeCount} />
        <MetricCard label="Konto joaktive" value={accountsPage.summary.inactiveCount} />
        <MetricCard label="Gjithsej konto" value={accountsPage.summary.accountCount} />
      </div>

      <form className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Filtrat e kontove</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <input type="text" name="accountSearch" defaultValue={accountSearch} placeholder="Kerko sipas kodit ose emrit" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <select name="category" defaultValue={category} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            {CATEGORY_OPTIONS.map((option) => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
          </select>
          <select name="reportSection" defaultValue={reportSection} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            {REPORT_SECTION_OPTIONS.map((option) => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div className="mt-4 flex gap-2">
          <button type="submit" className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">Apliko filtrat</button>
          <Link href="/financa/libri-kontabel/kontot" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Reset</Link>
        </div>
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Chart of Accounts</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Konto</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Kategoria</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Seksioni</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Debit</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Credit</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Balanca</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accountsPage.items.map((account) => (
                <tr key={account.id} className="align-top hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{account.code} - {account.name}</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <StatusBadge value={account.isActive} />
                      {account.isSystem ? <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200">System</span> : null}
                      {account.allowManual ? <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">Manual</span> : null}
                      {account.financeAccounts?.[0] ? <span className="inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 ring-1 ring-sky-200">{account.financeAccounts[0].code}</span> : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{account.category}</td>
                  <td className="px-4 py-3 text-slate-600">{account.reportSectionLabel}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{fmtMoney(account.debitTotal)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{fmtMoney(account.creditTotal)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">{fmtMoney(account.balance)}</td>
                </tr>
              ))}
              {accountsPage.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">Nuk u gjet asnje konto per filtrat e zgjedhur.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
