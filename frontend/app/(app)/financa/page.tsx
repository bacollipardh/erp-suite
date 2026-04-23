import { DomainActionCard } from '@/components/domain/domain-action-card';
import type {
  FinancialPeriodSummary,
  FinancialPeriodsPage,
} from '@/components/finance/financial-periods-client';
import { StatsCard } from '@/components/stats-card';
import { api } from '@/lib/api';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { requireAnyPagePermission } from '@/lib/server-page-auth';

function fmtMoney(value: number | string | null | undefined) {
  return `${Number(value ?? 0).toLocaleString('sq-AL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} EUR`;
}

export default async function FinanceHubPage() {
  const user = await requireAnyPagePermission([
    PERMISSIONS.reportsReceivables,
    PERMISSIONS.reportsPayables,
    PERMISSIONS.salesInvoicesPay,
    PERMISSIONS.purchaseInvoicesPay,
    PERMISSIONS.financeAccountsRead,
    PERMISSIONS.financialPeriodsRead,
    PERMISSIONS.accountingRead,
    PERMISSIONS.accountingManage,
    PERMISSIONS.reportsAccounting,
  ]);

  const currentYear = new Date().getUTCFullYear();
  const canReceivables = hasPermission(user.permissions, PERMISSIONS.reportsReceivables);
  const canPayables = hasPermission(user.permissions, PERMISSIONS.reportsPayables);
  const canReceiptReallocation = hasPermission(user.permissions, PERMISSIONS.salesInvoicesPay);
  const canPaymentReallocation = hasPermission(user.permissions, PERMISSIONS.purchaseInvoicesPay);
  const canFinanceAccounts = hasPermission(user.permissions, PERMISSIONS.financeAccountsRead);
  const canFinancialPeriods = hasPermission(user.permissions, PERMISSIONS.financialPeriodsRead);
  const canAccountingRead = hasPermission(user.permissions, PERMISSIONS.accountingRead);
  const canAccountingManage = hasPermission(user.permissions, PERMISSIONS.accountingManage);
  const canAccountingReports = hasPermission(user.permissions, PERMISSIONS.reportsAccounting);
  const canFinanceReports = hasPermission(user.permissions, [
    PERMISSIONS.reportsReceivables,
    PERMISSIONS.reportsPayables,
  ]);

  const [summary, accountSummary, reconciliationSummary, financialPeriodsPage] = await Promise.all([
    hasPermission(user.permissions, PERMISSIONS.dashboard)
      ? api.getOne('dashboard/summary')
      : Promise.resolve(null),
    canFinanceAccounts ? api.listPage('finance-accounts', { limit: 1 }) : Promise.resolve(null),
    canFinanceAccounts
      ? api.listPage('finance-reconciliation/statement-lines', { limit: 1 })
      : Promise.resolve(null),
    canFinancialPeriods
      ? api.listPage<FinancialPeriodsPage>('financial-periods', { year: currentYear })
      : Promise.resolve(null),
  ]);

  const currentFinancialPeriodId = financialPeriodsPage?.currentPeriodId ?? null;
  const currentFinancialPeriodSummary =
    canFinancialPeriods && currentFinancialPeriodId
      ? await api.fetch<FinancialPeriodSummary>(
          `/financial-periods/${currentFinancialPeriodId}/summary`,
        )
      : null;

  const openReconciliations =
    Number(reconciliationSummary?.summary?.unmatchedCount ?? 0) +
    Number(reconciliationSummary?.summary?.partiallyMatchedCount ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Qendra e Financave</h1>
        <p className="mt-1 text-sm text-slate-500">
          Arketimet, pagesat, rialokimet, aging dhe exposure jane te ndara qarte nga
          shitja dhe blerja qe perdoruesi te punoje sipas rolit financiar.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatsCard
          title="Arketime te Hapura"
          value={fmtMoney(summary?.outstanding?.receivables ?? 0)}
          href={canReceivables ? '/arketime' : undefined}
        />
        <StatsCard
          title="Detyrime te Hapura"
          value={fmtMoney(summary?.outstanding?.payables ?? 0)}
          href={canPayables ? '/pagesat' : undefined}
        />
        <StatsCard
          title="Arketime Kete Muaj"
          value={fmtMoney(summary?.cashflow?.receiptsMonth ?? 0)}
          href={canReceivables ? '/arketime' : undefined}
        />
        <StatsCard
          title="Pagesa Kete Muaj"
          value={fmtMoney(summary?.cashflow?.paymentsMonth ?? 0)}
          href={canPayables ? '/pagesat' : undefined}
        />
        <StatsCard
          title="Likuiditet Total"
          value={fmtMoney(accountSummary?.summary?.totalBalance ?? 0)}
          href={canFinanceAccounts ? '/financa/llogarite' : undefined}
        />
        <StatsCard
          title="Llogari Aktive"
          value={accountSummary?.summary?.activeCount ?? 0}
          subtitle={`${accountSummary?.summary?.accountCount ?? 0} gjithsej`}
          href={canFinanceAccounts ? '/financa/llogarite' : undefined}
        />
        <StatsCard
          title="Pajtime Bankare"
          value={openReconciliations}
          subtitle={`${reconciliationSummary?.summary?.matchedCount ?? 0} te mbyllura`}
          href={canFinanceAccounts ? '/financa/pajtimi-bankar' : undefined}
        />
        <StatsCard
          title="Periudhat Financiare"
          value={canFinancialPeriods ? 'Monthly close' : '-'}
          subtitle="Kontrolli i mbylljes mujore"
          href={canFinancialPeriods ? '/financa/periudhat' : undefined}
        />
        <StatsCard
          title="Libri Kontabel"
          value={canAccountingRead ? 'Aktiv' : '-'}
          subtitle="Chart of accounts & journal"
          href={canAccountingRead ? '/financa/libri-kontabel' : undefined}
        />
        <StatsCard
          title="Raportet Kontabel"
          value={canAccountingReports ? 'Hap' : '-'}
          subtitle="Trial balance, P&L, balance sheet"
          href={canAccountingReports ? '/raportet/kontabiliteti' : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {canFinanceAccounts ? (
          <DomainActionCard
            title="Llogarite Cash / Bank"
            description="Menaxho kasat, bankat, transfertat dhe ledger-in financiar qe mban gjendjen reale te likuiditetit."
            href="/financa/llogarite"
            badge="Treasury"
            tone="emerald"
          />
        ) : null}
        {canFinanceAccounts ? (
          <DomainActionCard
            title="Pajtimi Bankar"
            description="Importo ose regjistro levizjet e bankes dhe perputhi me arketimet, pagesat dhe transaksionet e ledger-it."
            href="/financa/pajtimi-bankar"
            badge="Reconciliation"
            tone="amber"
          />
        ) : null}
        {canFinancialPeriods ? (
          <DomainActionCard
            title="Periudhat Financiare"
            description="Hap, soft-close ose mbyll muajt financiare dhe kontrollo closing pack me blockers, exposure dhe reconciliation."
            href="/financa/periudhat"
            badge="Month End"
            tone="slate"
          />
        ) : null}
        {canAccountingRead ? (
          <DomainActionCard
            title="Libri Kontabel"
            description="Kontrollo chart of accounts, journal entries dhe balancat e ledger-it te gjeneruara nga i gjithe sistemi."
            href="/financa/libri-kontabel"
            badge="Accounting"
            tone="indigo"
          />
        ) : null}
        {canAccountingManage ? (
          <DomainActionCard
            title="Journal Entry Manuale"
            description="Regjistro accruals, deferrals, VAT adjustments dhe hyrje te tjera manuale qe nuk vijne nga dokumentet operative."
            href="/financa/libri-kontabel/new"
            badge="Accounting"
            tone="emerald"
          />
        ) : null}
        {canAccountingManage ? (
          <DomainActionCard
            title="Mbyllja Kontabel"
            description="Shiko preview te closing entry mujore dhe kalo net profit / loss te fitimi i mbartur para close-it financiar."
            href="/financa/mbyllja-kontabel"
            badge="Month End"
            tone="amber"
          />
        ) : null}
        {canAccountingReports ? (
          <DomainActionCard
            title="Raportet Kontabel"
            description="Shiko trial balance, fitim-humbjen dhe balance sheet mbi journal entries reale dhe periudha financiare."
            href="/raportet/kontabiliteti"
            badge="Accounting"
            tone="slate"
          />
        ) : null}
        {canReceivables ? (
          <DomainActionCard
            title="Arketimet"
            description="Menaxho pagesat hyrese te klienteve, filtrat, due states dhe lidhjet me faturat e shitjes."
            href="/arketime"
            badge="Receivables"
            tone="indigo"
          />
        ) : null}
        {canReceiptReallocation ? (
          <DomainActionCard
            title="Rialokimi i Arketimeve"
            description="Apliko balance `unapplied` te klienteve te dokumente te tjera konkrete me audit trail te plote."
            href="/arketime/rialokime"
            badge="Receivables"
            tone="emerald"
          />
        ) : null}
        {canPayables ? (
          <DomainActionCard
            title="Pagesat"
            description="Menaxho pagesat ndaj furnitoreve, aktivitetin e fundit dhe gjendjen pas cdo disbursimi."
            href="/pagesat"
            badge="Payables"
            tone="indigo"
          />
        ) : null}
        {canPaymentReallocation ? (
          <DomainActionCard
            title="Rialokimi i Pagesave"
            description="Ri-apliko tepricat e pagesave te furnitoreve te dokumente te tjera me ledger dhe audit trail."
            href="/pagesat/rialokime"
            badge="Payables"
            tone="amber"
          />
        ) : null}
        {canFinanceReports ? (
          <DomainActionCard
            title="Raportet Financiare"
            description="Shiko aging, exposure, receivables dhe payables ne nje raportim te ndare nga shitja."
            href="/raportet/financa"
            badge="Raportim"
            tone="slate"
          />
        ) : null}
      </div>

      {canFinancialPeriods && currentFinancialPeriodSummary ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Month-End Control Center</h2>
              <p className="mt-1 text-sm text-slate-500">
                Periudha aktuale {currentFinancialPeriodSummary.period.label} monitorohet me
                checklist, exposure dhe exceptions para mbylljes mujore.
              </p>
            </div>
            <a
              href="/financa/periudhat"
              className="inline-flex rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Hap periudhat financiare
            </a>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
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

          <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Checklist i mbylljes</h3>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <span>Receivables overdue</span>
                  <span className="font-semibold">
                    {currentFinancialPeriodSummary.checklist.overdueReceivablesCount}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Payables overdue</span>
                  <span className="font-semibold">
                    {currentFinancialPeriodSummary.checklist.overduePayablesCount}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Unapplied receipts</span>
                  <span className="font-semibold">
                    {currentFinancialPeriodSummary.checklist.unappliedReceiptCount}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Unapplied payments</span>
                  <span className="font-semibold">
                    {currentFinancialPeriodSummary.checklist.unappliedPaymentCount}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Draft docs</span>
                  <span className="font-semibold">
                    {currentFinancialPeriodSummary.checklist.draftSalesCount +
                      currentFinancialPeriodSummary.checklist.draftPurchaseCount +
                      currentFinancialPeriodSummary.checklist.draftReturnCount}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Arsyet kryesore</h3>
              <p className="mt-2 text-sm text-slate-600">
                {currentFinancialPeriodSummary.checklist.periodReadyToClose
                  ? 'Periudha aktuale duket gati per soft-close ose close sipas kontrollit financiar.'
                  : 'Mbyllja mujore ende ka bllokues aktive ne aging, unapplied balances ose pajtimin bankar.'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <a href="/arketime" className="font-medium text-indigo-700 hover:text-indigo-900">
                  Shiko arketimet
                </a>
                <a href="/pagesat" className="font-medium text-indigo-700 hover:text-indigo-900">
                  Shiko pagesat
                </a>
                <a
                  href="/financa/pajtimi-bankar"
                  className="font-medium text-indigo-700 hover:text-indigo-900"
                >
                  Shiko pajtimin bankar
                </a>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
