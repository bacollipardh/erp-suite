import Link from 'next/link';
import { DomainActionCard } from '@/components/domain/domain-action-card';
import { PageHeader } from '@/components/page-header';
import { StatsCard } from '@/components/stats-card';
import { api } from '@/lib/api';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { requireAnyPagePermission } from '@/lib/server-page-auth';

type FinancialPeriodsPage = {
  currentPeriodId?: string | null;
};

type FinancialPeriodSummary = {
  period: { label: string; status: string };
  checklist: {
    blockerCount: number;
    periodReadyToClose: boolean;
  };
};

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

  const canReceivables = hasPermission(user.permissions, PERMISSIONS.reportsReceivables);
  const canPayables = hasPermission(user.permissions, PERMISSIONS.reportsPayables);
  const canReceiptReallocation = hasPermission(user.permissions, PERMISSIONS.salesInvoicesPay);
  const canPaymentReallocation = hasPermission(user.permissions, PERMISSIONS.purchaseInvoicesPay);
  const canFinanceAccounts = hasPermission(user.permissions, PERMISSIONS.financeAccountsRead);
  const canFinancialPeriods = hasPermission(user.permissions, PERMISSIONS.financialPeriodsRead);
  const canAccountingRead = hasPermission(user.permissions, PERMISSIONS.accountingRead);
  const canAccountingManage = hasPermission(user.permissions, PERMISSIONS.accountingManage);
  const canAccountingReports = hasPermission(user.permissions, PERMISSIONS.reportsAccounting);
  const canPaymentMethods = hasPermission(user.permissions, PERMISSIONS.paymentMethodsRead);
  const canTaxRates = hasPermission(user.permissions, PERMISSIONS.taxRatesRead);
  const canDocumentSeries = hasPermission(user.permissions, PERMISSIONS.documentSeriesRead);
  const canFinanceReports = hasPermission(user.permissions, [
    PERMISSIONS.reportsReceivables,
    PERMISSIONS.reportsPayables,
  ]);

  const currentYear = new Date().getUTCFullYear();

  const [
    summary,
    accountSummary,
    reconciliationSummary,
    financialPeriodsPage,
    accountingAccountsPage,
    paymentMethods,
    taxRates,
    documentSeries,
  ] = await Promise.all([
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
    canAccountingRead
      ? api.listPage('accounting/accounts', { limit: 1 })
      : Promise.resolve(null),
    canPaymentMethods ? api.list('payment-methods', { limit: 100 }) : Promise.resolve([]),
    canTaxRates ? api.list('tax-rates', { limit: 100 }) : Promise.resolve([]),
    canDocumentSeries ? api.list('document-series', { limit: 100 }) : Promise.resolve([]),
  ]);

  const currentFinancialPeriodSummary =
    canFinancialPeriods && financialPeriodsPage?.currentPeriodId
      ? await api.fetch<FinancialPeriodSummary>(
          `/financial-periods/${financialPeriodsPage.currentPeriodId}/summary`,
        )
      : null;

  const openReconciliations =
    Number(reconciliationSummary?.summary?.unmatchedCount ?? 0) +
    Number(reconciliationSummary?.summary?.partiallyMatchedCount ?? 0);
  const activeFinanceAccounts = Number(accountSummary?.summary?.activeCount ?? 0);
  const accountingAccountCount = Number(accountingAccountsPage?.summary?.activeCount ?? 0);
  const paymentMethodCount = countPayload(paymentMethods);
  const taxRateCount = countPayload(taxRates);
  const documentSeriesCount = countPayload(documentSeries);
  const monthlyBlockers = Number(currentFinancialPeriodSummary?.checklist?.blockerCount ?? 0);

  const setupWarnings = [
    activeFinanceAccounts <= 0 && canFinanceAccounts
      ? {
          title: 'Mungon arka ose banka aktive',
          description:
            'Krijo së paku një finance account aktive që arkëtimet, pagesat dhe transferet të kenë llogari burimore.',
          href: '/financa/llogarite/new',
          cta: 'Krijo llogari financiare',
        }
      : null,
    accountingAccountCount <= 0 && canAccountingRead
      ? {
          title: 'Mungon chart of accounts',
          description:
            'Pa konto kontabël aktive, postimet financiare nuk mund të kontrollohen si duhet në ledger.',
          href: '/financa/libri-kontabel/kontot',
          cta: 'Shiko kontot kontabël',
        }
      : null,
    !financialPeriodsPage?.currentPeriodId && canFinancialPeriods
      ? {
          title: 'Nuk ka periudhë financiare aktuale',
          description:
            'Gjenero ose hap periudhën financiare që dokumentet të kontrollohen sipas muajit aktiv.',
          href: '/financa/periudhat',
          cta: 'Hap periudhat',
        }
      : null,
    paymentMethodCount <= 0 && canPaymentMethods
      ? {
          title: 'Mungojnë metodat e pagesës',
          description:
            'Shto cash, bank transfer, POS ose metoda tjera që dokumentet e arkëtimit/pagesës të jenë të standardizuara.',
          href: '/payment-methods',
          cta: 'Konfiguro metodat',
        }
      : null,
    taxRateCount <= 0 && canTaxRates
      ? {
          title: 'Mungojnë normat e TVSH-së',
          description: 'Pa tax rates aktive, faturat dhe raportet e TVSH-së nuk mund të jenë të sakta.',
          href: '/tax-rates',
          cta: 'Konfiguro TVSH',
        }
      : null,
    documentSeriesCount <= 0 && canDocumentSeries
      ? {
          title: 'Mungojnë seritë e dokumenteve',
          description:
            'Seritë përcaktojnë numrat e dokumenteve për faturat, arkëtimet, pagesat dhe dokumentet tjera.',
          href: '/document-series',
          cta: 'Konfiguro seritë',
        }
      : null,
  ].filter(Boolean) as Array<{ title: string; description: string; href: string; cta: string }>;

  const setupReady = setupWarnings.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance Control Center"
        description="Kontrolli ditor i arkave, bankave, borxheve, setup-it financiar, pajtimit bankar dhe mbylljes mujore."
      />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <HealthCard
          title="Setup Financiar"
          value={setupReady ? 'Gati' : `${setupWarnings.length} çështje`}
          subtitle={setupReady ? 'Konfigurimi bazë duket i plotë' : 'Ka konfigurime që duhen mbyllur'}
          tone={setupReady ? 'emerald' : 'amber'}
          href={setupWarnings[0]?.href}
        />
        <HealthCard
          title="Likuiditet"
          value={fmtMoney(accountSummary?.summary?.totalBalance ?? 0)}
          subtitle={`${activeFinanceAccounts} llogari aktive`}
          tone="indigo"
          href={canFinanceAccounts ? '/financa/llogarite' : undefined}
        />
        <HealthCard
          title="Pajtim Bankar"
          value={openReconciliations}
          subtitle={openReconciliations ? 'Rreshta kërkojnë match' : 'Pa exception aktive'}
          tone={openReconciliations ? 'amber' : 'emerald'}
          href={canFinanceAccounts ? '/financa/pajtimi-bankar' : undefined}
        />
        <HealthCard
          title="Mbyllja Mujore"
          value={monthlyBlockers}
          subtitle={
            currentFinancialPeriodSummary?.period?.label
              ? `${currentFinancialPeriodSummary.period.label} blockers`
              : 'Pa periudhë aktuale'
          }
          tone={monthlyBlockers ? 'rose' : 'emerald'}
          href={canFinancialPeriods ? '/financa/kontrolli-mujor' : undefined}
        />
      </section>

      {setupWarnings.length ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Setup Warnings</h2>
            <p className="mt-1 text-sm text-slate-500">
              Këto janë gjërat minimale që financa duhet t'i mbyllë para përdorimit real.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
            {setupWarnings.map((warning) => (
              <SetupWarningCard key={warning.title} {...warning} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Veprimet e radhës</h2>
            <p className="mt-1 text-sm text-slate-500">
              Hyrje të shpejta për punën ditore të financës.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/arketime/new" className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              Arketim i ri
            </Link>
            <Link href="/pagesat/new" className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
              Pagesë e re
            </Link>
            <Link href="/financa/transfere/new" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Transfer
            </Link>
            <Link href="/financa/mbyllja-ditore" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Mbyllja ditore
            </Link>
            <Link href="/financa/pajtimi-bankar/new" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Statement line
            </Link>
          </div>
        </div>
      </section>

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
            title="Mbyllja Ditore e Arkës"
            description="Hap ditën, numëro cash-in fizik, krahaso me ledger-in dhe regjistro diferencën para dorëzimit."
            href="/financa/mbyllja-ditore"
            badge="Daily Close"
            tone="amber"
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
        {canFinancialPeriods ? (
          <DomainActionCard
            title="Kontrolli Mujor"
            description="Shiko checklist-in e mbylljes, overdue exposure dhe exceptions para close-it mujor."
            href="/financa/kontrolli-mujor"
            badge="Month End"
            tone="amber"
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
        {canAccountingRead ? (
          <DomainActionCard
            title="TVSH & Taksat"
            description="Mbyll settlement-in mujor te TVSH-se, sheno filing reference dhe regjistro pagesen reale nga banka ose arka."
            href="/financa/tvsh"
            badge="Tax"
            tone="emerald"
          />
        ) : null}
        {canAccountingRead ? (
          <DomainActionCard
            title="Deklarata Mujore e TVSH-se"
            description="Gjenero deklaraten mujore nga settlement-i, ruaj snapshot auditues dhe eksporto dokumentin ne CSV, JSON ose PDF."
            href="/financa/deklarata-tvsh"
            badge="Tax Return"
            tone="indigo"
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

    </div>
  );
}

function countPayload(value: any) {
  if (!value) return 0;
  if (Array.isArray(value)) return value.length;
  if (Array.isArray(value.items)) return Number(value.total ?? value.items.length);
  return Number(value.total ?? value.summary?.total ?? value.summary?.accountCount ?? 0);
}

function HealthCard({
  title,
  value,
  subtitle,
  tone = 'slate',
  href,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  tone?: 'slate' | 'emerald' | 'amber' | 'rose' | 'indigo';
  href?: string;
}) {
  const toneClass =
    tone === 'emerald'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : tone === 'rose'
          ? 'border-rose-200 bg-rose-50 text-rose-800'
          : tone === 'indigo'
            ? 'border-indigo-200 bg-indigo-50 text-indigo-800'
            : 'border-slate-200 bg-white text-slate-800';
  const content = (
    <div className={`rounded-xl border p-4 shadow-sm ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-75">{title}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      <p className="mt-1 text-sm opacity-80">{subtitle}</p>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

function SetupWarningCard({
  title,
  description,
  href,
  cta,
}: {
  title: string;
  description: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <h3 className="text-sm font-semibold text-amber-950">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-amber-800">{description}</p>
      <Link href={href} className="mt-3 inline-flex text-sm font-semibold text-amber-900 hover:text-amber-700">
        {cta}
      </Link>
    </div>
  );
}
