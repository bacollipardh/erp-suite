import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { api } from '@/lib/api';
import { formatDateOnly } from '@/lib/date';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

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

type StatementResponse = {
  filters: {
    dateFrom?: string | null;
    dateTo?: string | null;
    asOfDate?: string | null;
    includeZero: boolean;
  };
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

function StatementCard({
  title,
  description,
  sections,
}: {
  title: string;
  description: string;
  sections: StatementResponse['sections'];
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="space-y-4 p-5">
        {sections.map((section) => (
          <div key={section.section} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{section.label}</p>
                <p className="text-xs text-slate-400">{section.items.length} konto</p>
              </div>
              <p className="text-sm font-semibold text-slate-900">{fmtMoney(section.total)}</p>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-slate-200">
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Konto
                    </th>
                    <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Debit
                    </th>
                    <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Credit
                    </th>
                    <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Shuma
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {section.items.map((item) => (
                    <tr key={`${section.section}-${item.accountId}`}>
                      <td className="px-2 py-2 text-slate-700">
                        {item.accountCode} - {item.accountName}
                      </td>
                      <td className="px-2 py-2 text-right text-slate-600">{fmtMoney(item.debit)}</td>
                      <td className="px-2 py-2 text-right text-slate-600">{fmtMoney(item.credit)}</td>
                      <td className="px-2 py-2 text-right font-medium text-slate-900">
                        {fmtMoney(item.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        {sections.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">
            Nuk ka konto me levizje per filtrat e zgjedhur.
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default async function AccountingReportsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePagePermission(PERMISSIONS.reportsAccounting);
  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const yearStart = `${new Date().getUTCFullYear()}-01-01`;
  const dateFrom = readParam(params, 'dateFrom', yearStart);
  const dateTo = readParam(params, 'dateTo', today);
  const asOfDate = readParam(params, 'asOfDate', dateTo || today);
  const includeZero = readParam(params, 'includeZero') === 'true';

  const [trialBalance, profitLoss, balanceSheet] = await Promise.all([
    api.query<TrialBalanceResponse>('accounting/trial-balance', {
      dateFrom,
      asOfDate,
      includeZero,
    }),
    api.query<StatementResponse>('accounting/profit-loss', {
      dateFrom,
      dateTo,
      includeZero,
    }),
    api.query<StatementResponse>('accounting/balance-sheet', {
      asOfDate,
      includeZero,
    }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Raportet Kontabel"
        description="Trial balance, pasqyra e fitim-humbjes dhe balance sheet mbi journal entries reale."
      />

      <div className="flex flex-wrap gap-2">
        <Link
          href="/financa/libri-kontabel"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Hap librin kontabel
        </Link>
        <Link
          href="/raportet"
          className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:text-indigo-900"
        >
          Kthehu te qendra e raporteve
        </Link>
      </div>

      <form className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Filtrat e raportimit</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
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
          <input
            type="date"
            name="asOfDate"
            defaultValue={asOfDate}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">
            <input type="checkbox" name="includeZero" value="true" defaultChecked={includeZero} />
            Perfshi edhe kontot zero
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Apliko filtrat
          </button>
          <Link
            href="/raportet/kontabiliteti"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Reset
          </Link>
        </div>
      </form>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard
          label="Net Profit"
          value={fmtMoney(profitLoss.summary.netProfit)}
          sub={`${formatDateOnly(dateFrom)} deri ${formatDateOnly(dateTo)}`}
        />
        <MetricCard
          label="Total Assets"
          value={fmtMoney(balanceSheet.summary.totalAssets)}
          sub={`As of ${formatDateOnly(asOfDate)}`}
        />
        <MetricCard
          label="Liabilities + Equity"
          value={fmtMoney(balanceSheet.summary.totalLiabilitiesAndEquity)}
          sub={`Diferenca ${fmtMoney(balanceSheet.summary.difference)}`}
        />
        <MetricCard
          label="Trial Balance"
          value={trialBalance.summary.accountCount}
          sub={`${fmtMoney(trialBalance.summary.totalPeriodDebit)} debit / ${fmtMoney(
            trialBalance.summary.totalPeriodCredit,
          )} credit`}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Trial Balance</h2>
          <p className="mt-1 text-sm text-slate-500">
            Levizjet e periudhes dhe bilancet mbyllese per secilen konto.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Konto
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Hapja
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Debit
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Credit
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Mbyllja
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {trialBalance.items.map((item) => (
                <tr key={item.accountId}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">
                      {item.accountCode} - {item.accountName}
                    </div>
                    <div className="text-xs text-slate-400">{item.reportSectionLabel}</div>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {fmtMoney(item.openingBalance)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {fmtMoney(item.periodDebit)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {fmtMoney(item.periodCredit)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    {fmtMoney(item.closingBalance)}
                  </td>
                </tr>
              ))}
              {trialBalance.items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
                    Nuk ka trial balance rows per filtrat e zgjedhur.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <StatementCard
          title="Profit & Loss"
          description="Pasqyra e fitim-humbjes e ndertuar mbi kontot e te ardhurave dhe shpenzimeve."
          sections={profitLoss.sections}
        />
        <StatementCard
          title="Balance Sheet"
          description="Aktivet, detyrimet dhe kapitali ne daten e zgjedhur."
          sections={balanceSheet.sections}
        />
      </div>
    </div>
  );
}
