import Link from 'next/link';
import type {
  FinancialPeriodSummary,
  FinancialPeriodsPage,
} from '@/components/finance/financial-periods-client';
import { PageHeader } from '@/components/page-header';
import { StatsCard } from '@/components/stats-card';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

function fmtMoney(value: number | string | null | undefined) {
  return `${Number(value ?? 0).toLocaleString('sq-AL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} EUR`;
}

export default async function MonthlyControlPage() {
  await requirePagePermission(PERMISSIONS.financialPeriodsRead);
  const currentYear = new Date().getUTCFullYear();
  const financialPeriodsPage = await api.listPage<FinancialPeriodsPage>('financial-periods', {
    year: currentYear,
  });

  const currentFinancialPeriodId = financialPeriodsPage.currentPeriodId ?? null;
  const currentFinancialPeriodSummary =
    currentFinancialPeriodId
      ? await api.fetch<FinancialPeriodSummary>(
          `/financial-periods/${currentFinancialPeriodId}/summary`,
        )
      : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader
          title="Kontrolli Mujor"
          description="Checklist i mbylljes, overdue exposure dhe reconciliation exceptions para close-it mujor."
        />
        <div className="flex flex-wrap gap-2">
          <Link
            href="/financa/periudhat"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Hap periudhat financiare
          </Link>
          <Link
            href="/financa"
            className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:text-indigo-900"
          >
            Kthehu te financa
          </Link>
        </div>
      </div>

      {currentFinancialPeriodSummary ? (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatsCard
              title="Blockers"
              value={currentFinancialPeriodSummary.checklist.blockerCount}
              subtitle={
                currentFinancialPeriodSummary.checklist.periodReadyToClose
                  ? 'Ready to close'
                  : 'Kerkohen veprime para mbylljes'
              }
              href="/financa/periudhat"
            />
            <StatsCard
              title="Receivables Overdue"
              value={currentFinancialPeriodSummary.checklist.overdueReceivablesCount}
              subtitle={fmtMoney(
                currentFinancialPeriodSummary.summary.overdueReceivablesOutstanding,
              )}
              href="/arketime"
            />
            <StatsCard
              title="Payables Overdue"
              value={currentFinancialPeriodSummary.checklist.overduePayablesCount}
              subtitle={fmtMoney(currentFinancialPeriodSummary.summary.overduePayablesOutstanding)}
              href="/pagesat"
            />
            <StatsCard
              title="Reconciliation Exceptions"
              value={currentFinancialPeriodSummary.checklist.reconciliationExceptionCount}
              subtitle={fmtMoney(currentFinancialPeriodSummary.summary.reconciliationDifference)}
              href="/financa/pajtimi-bankar"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">
                Checklist i mbylljes - {currentFinancialPeriodSummary.period.label}
              </h2>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div className="flex items-center justify-between"><span>Receivables overdue</span><strong>{currentFinancialPeriodSummary.checklist.overdueReceivablesCount}</strong></div>
                <div className="flex items-center justify-between"><span>Payables overdue</span><strong>{currentFinancialPeriodSummary.checklist.overduePayablesCount}</strong></div>
                <div className="flex items-center justify-between"><span>Unapplied receipts</span><strong>{currentFinancialPeriodSummary.checklist.unappliedReceiptCount}</strong></div>
                <div className="flex items-center justify-between"><span>Unapplied payments</span><strong>{currentFinancialPeriodSummary.checklist.unappliedPaymentCount}</strong></div>
                <div className="flex items-center justify-between">
                  <span>Draft docs</span>
                  <strong>
                    {currentFinancialPeriodSummary.checklist.draftSalesCount +
                      currentFinancialPeriodSummary.checklist.draftPurchaseCount +
                      currentFinancialPeriodSummary.checklist.draftReturnCount}
                  </strong>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Statusi i mbylljes</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {currentFinancialPeriodSummary.checklist.periodReadyToClose
                  ? 'Periudha aktuale duket gati per soft-close ose close sipas kontrollit financiar.'
                  : 'Mbyllja mujore ende ka bllokues aktive ne aging, unapplied balances ose pajtimin bankar.'}
              </p>
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <Link href="/arketime" className="font-medium text-indigo-700 hover:text-indigo-900">Shiko arketimet</Link>
                <Link href="/pagesat" className="font-medium text-indigo-700 hover:text-indigo-900">Shiko pagesat</Link>
                <Link href="/financa/pajtimi-bankar" className="font-medium text-indigo-700 hover:text-indigo-900">Shiko pajtimin bankar</Link>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
          Nuk ka periudhe aktuale per kontroll mujor.
        </div>
      )}
    </div>
  );
}
