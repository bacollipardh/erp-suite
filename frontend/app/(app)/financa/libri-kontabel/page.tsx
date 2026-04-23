import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { api } from '@/lib/api';
import { formatDateOnly } from '@/lib/date';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type LedgerAccountsPage = {
  items: Array<{
    id: string;
    code: string;
    name: string;
    category: string;
    reportSection: string;
    reportSectionLabel: string;
    isActive: boolean;
    isSystem: boolean;
    allowManual: boolean;
    balance: number;
    debitTotal: number;
    creditTotal: number;
    financeAccounts?: Array<{
      id: string;
      code: string;
      name: string;
      accountType: string;
    }>;
  }>;
  total: number;
  page: number;
  limit: number;
  pageCount: number;
  summary: {
    accountCount: number;
    activeCount: number;
    inactiveCount: number;
  };
};

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
    createdBy?: {
      id: string;
      fullName: string;
      email?: string | null;
    } | null;
    lines: Array<{
      id: string;
      lineNo: number;
      side: string;
      amount: number | string;
      partyName?: string | null;
      description?: string | null;
      account: {
        id: string;
        code: string;
        name: string;
      };
    }>;
  }>;
  total: number;
  page: number;
  limit: number;
  pageCount: number;
  summary: {
    count: number;
    visibleCount: number;
    visibleDebitTotal: number;
    visibleCreditTotal: number;
  };
};

type TrialBalanceResponse = {
  filters: {
    dateFrom?: string | null;
    asOfDate: string;
    includeZero: boolean;
  };
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
    category: string;
    reportSection: string;
    reportSectionLabel: string;
    openingBalance: number;
    movementBalance: number;
    periodDebit: number;
    periodCredit: number;
    closingBalance: number;
    closingDebitBalance: number;
    closingCreditBalance: number;
  }>;
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

function readParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
  fallback = '',
) {
  const value = params[key];
  return typeof value === 'string' ? value : fallback;
}

function fmtMoney(value: number | string | null | undefined) {
  return `${Number(value ?? 0).toLocaleString('sq-AL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} EUR`;
}

function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-400">{sub}</p> : null}
    </div>
  );
}

export default async function AccountingLedgerPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requirePagePermission(PERMISSIONS.accountingRead);
  const params = await searchParams;
  const canReportsAccounting = hasPermission(user.permissions, PERMISSIONS.reportsAccounting);
  const today = new Date().toISOString().slice(0, 10);
  const currentYearStart = `${new Date().getUTCFullYear()}-01-01`;

  const accountSearch = readParam(params, 'accountSearch');
  const category = readParam(params, 'category');
  const reportSection = readParam(params, 'reportSection');
  const journalSearch = readParam(params, 'journalSearch');
  const sourceType = readParam(params, 'sourceType');
  const dateFrom = readParam(params, 'dateFrom', currentYearStart);
  const dateTo = readParam(params, 'dateTo', today);

  const [accountsPage, journalEntriesPage, trialBalance] = await Promise.all([
    api.listPage<LedgerAccountsPage>('accounting/accounts', {
      search: accountSearch,
      category,
      reportSection,
      page: 1,
      limit: 12,
      sortBy: 'code',
      sortOrder: 'asc',
    }),
    api.listPage<JournalEntriesPage>('accounting/journal-entries', {
      search: journalSearch,
      sourceType,
      dateFrom,
      dateTo,
      page: 1,
      limit: 8,
      sortBy: 'entryDate',
      sortOrder: 'desc',
    }),
    canReportsAccounting
      ? api.query<TrialBalanceResponse>('accounting/trial-balance', {
          dateFrom,
          asOfDate: dateTo,
          includeZero: false,
        })
      : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Libri Kontabel"
        description="Chart of accounts, journal entries dhe gjendja aktuale e ledger-it ne nje vend te vetem."
        createHref="/financa/libri-kontabel/new"
        createLabel="Journal Manual"
        createPermission={PERMISSIONS.accountingManage}
      />

      <div className="flex flex-wrap gap-2">
        {canReportsAccounting ? (
          <Link
            href={`/raportet/kontabiliteti?dateFrom=${dateFrom}&dateTo=${dateTo}&asOfDate=${dateTo}`}
            className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:text-indigo-900"
          >
            Hap raportet kontabel
          </Link>
        ) : null}
        {hasPermission(user.permissions, PERMISSIONS.accountingManage) ? (
          <Link
            href="/financa/mbyllja-kontabel"
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:text-amber-900"
          >
            Hap mbylljen kontabel
          </Link>
        ) : null}
        <Link
          href="/financa/llogarite"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Llogarite cash / bank
        </Link>
        <Link
          href="/financa"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Kthehu te financa
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard
          label="Konto aktive"
          value={accountsPage.summary.activeCount}
          sub={`${accountsPage.summary.accountCount} gjithsej`}
        />
        <MetricCard
          label="Journal entries"
          value={journalEntriesPage.summary.count}
          sub={`${journalEntriesPage.summary.visibleCount} ne pamjen aktuale`}
        />
        <MetricCard
          label="Debit ne periudhe"
          value={fmtMoney(trialBalance?.summary.totalPeriodDebit ?? 0)}
          sub={`${dateFrom} deri ${dateTo}`}
        />
        <MetricCard
          label="Credit ne periudhe"
          value={fmtMoney(trialBalance?.summary.totalPeriodCredit ?? 0)}
          sub={`${trialBalance?.summary.accountCount ?? 0} konto me levizje`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <form className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Filtrat e chart of accounts</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              type="text"
              name="accountSearch"
              defaultValue={accountSearch}
              placeholder="Kerko sipas kodit ose emrit"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <select
              name="category"
              defaultValue={category}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              name="reportSection"
              defaultValue={reportSection}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
            >
              {REPORT_SECTION_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Apliko filtrat
            </button>
            <Link
              href="/financa/libri-kontabel"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Reset
            </Link>
          </div>
        </form>

        <form className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Filtrat e journal entries</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              type="text"
              name="journalSearch"
              defaultValue={journalSearch}
              placeholder="Kerko sipas numrit, pershkrimit ose burimit"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
            />
            <input
              type="text"
              name="sourceType"
              defaultValue={sourceType}
              placeholder="Shembull: SALES_INVOICE"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="date"
              name="dateFrom"
              defaultValue={dateFrom}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="date"
              name="dateTo"
              defaultValue={dateTo}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Rifresko journal-in
            </button>
            <Link
              href="/financa/libri-kontabel"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Reset
            </Link>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Chart of Accounts</h2>
          <p className="mt-1 text-sm text-slate-500">
            Konto sistemore dhe konto te lidhura me kasa / banka, me bilancin aktual per secilen.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Konto
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Kategoria
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Seksioni
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Debit
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Credit
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Balanca
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accountsPage.items.map((account) => (
                <tr key={account.id} className="align-top hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">
                      {account.code} - {account.name}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <StatusBadge value={account.isActive} />
                      {account.isSystem ? (
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                          System
                        </span>
                      ) : null}
                      {account.allowManual ? (
                        <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                          Manual
                        </span>
                      ) : null}
                      {account.financeAccounts?.[0] ? (
                        <span className="inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 ring-1 ring-sky-200">
                          {account.financeAccounts[0].code}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{account.category}</td>
                  <td className="px-4 py-3 text-slate-600">{account.reportSectionLabel}</td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {fmtMoney(account.debitTotal)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {fmtMoney(account.creditTotal)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    {fmtMoney(account.balance)}
                  </td>
                </tr>
              ))}
              {accountsPage.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                    Nuk u gjet asnje konto per filtrat e zgjedhur.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Journal Entries</h2>
          <p className="mt-1 text-sm text-slate-500">
            Hyrjet kontabel te gjeneruara nga shitja, blerja, financa, stoku dhe journal-et manuale.
          </p>
        </div>
        <div className="divide-y divide-slate-100">
          {journalEntriesPage.items.map((entry) => (
            <div key={entry.id} className="p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-slate-900">{entry.entryNo}</p>
                    {entry.sourceType ? (
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                        {entry.sourceType}
                      </span>
                    ) : null}
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
                    <p className="text-sm font-semibold text-slate-900">
                      {fmtMoney(entry.debitTotal)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Credit</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {fmtMoney(entry.creditTotal)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-b bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Linja
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Konto
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Ana
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Shuma
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {entry.lines.map((line) => (
                      <tr key={line.id}>
                        <td className="px-3 py-2 text-slate-600">{line.lineNo}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-900">
                            {line.account.code} - {line.account.name}
                          </div>
                          {line.partyName || line.description ? (
                            <div className="mt-0.5 text-xs text-slate-400">
                              {[line.partyName, line.description].filter(Boolean).join(' | ')}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
                              line.side === 'DEBIT'
                                ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                                : 'bg-indigo-50 text-indigo-700 ring-indigo-200'
                            }`}
                          >
                            {line.side === 'DEBIT' ? 'Debit' : 'Credit'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-slate-900">
                          {fmtMoney(line.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {journalEntriesPage.items.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-400">
              Nuk ka journal entries per filtrat e zgjedhur.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
