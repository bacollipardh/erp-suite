import Link from 'next/link';
import { DomainActionCard } from '@/components/domain/domain-action-card';
import type {
  FinancialPeriodSummary,
  FinancialPeriodsPage,
} from '@/components/finance/financial-periods-client';
import { DueStateReminder } from '@/components/finance/due-state-reminder';
import { StatsCard } from '@/components/stats-card';
import { StatusBadge } from '@/components/status-badge';
import { api } from '@/lib/api';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

function fmtMoney(value: number | string | null | undefined) {
  return `${Number(value ?? 0).toLocaleString('sq-AL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} EUR`;
}

function buildAgingSubtitle(summary: {
  openCount?: number;
  overdueCount?: number;
  dueTodayCount?: number;
}) {
  const parts = [`${summary.openCount ?? 0} dokumente te hapura`];

  if ((summary.overdueCount ?? 0) > 0) {
    parts.push(`${summary.overdueCount} me vonese`);
  }

  if ((summary.dueTodayCount ?? 0) > 0) {
    parts.push(`${summary.dueTodayCount} skadojne sot`);
  }

  return parts.join(' - ');
}

function formatDate(value?: string | null) {
  if (!value) return 'Pa afat';
  return new Intl.DateTimeFormat('sq-AL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function DashboardSection({
  title,
  description,
  href,
  hrefLabel = 'Hap domenin',
}: {
  title: string;
  description: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {href ? (
        <Link
          href={href}
          className="inline-flex rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {hrefLabel}
        </Link>
      ) : null}
    </div>
  );
}

function ReminderPanel({
  title,
  description,
  items,
  detailBasePath,
  actionBasePath,
  actionLabel,
}: {
  title: string;
  description: string;
  items: Array<{
    id: string;
    docNo: string;
    dueDate?: string | null;
    dueState: string;
    daysPastDue: number;
    outstandingAmount: number;
    party?: { id: string; name: string } | null;
  }>;
  detailBasePath: string;
  actionBasePath?: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
          Nuk ka dokumente kritike ne kete kategori.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="font-mono text-xs text-slate-500">{item.docNo}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {item.party?.name ?? '-'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Afati: {formatDate(item.dueDate)} | Mbetur:{' '}
                    {fmtMoney(Number(item.outstandingAmount ?? 0))}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge value={item.dueState} />
                  <span className="text-xs text-slate-500">
                    {item.daysPastDue > 0 ? `${item.daysPastDue} dite` : 'Sot'}
                  </span>
                </div>
              </div>

              <div className="mt-3">
                <DueStateReminder
                  compact
                  dueState={item.dueState}
                  dueDate={item.dueDate}
                  daysPastDue={item.daysPastDue}
                  outstandingAmount={item.outstandingAmount}
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <Link
                  href={`${detailBasePath}/${item.id}`}
                  className="font-medium text-indigo-700 hover:text-indigo-900"
                >
                  Hap dokumentin
                </Link>
                {actionBasePath && actionLabel ? (
                  <Link
                    href={`${actionBasePath}?documentId=${item.id}`}
                    className="font-medium text-emerald-700 hover:text-emerald-900"
                  >
                    {actionLabel}
                  </Link>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function DashboardPage() {
  const user = await requirePagePermission(PERMISSIONS.dashboard);
  const currentYear = new Date().getUTCFullYear();
  const canFinancialPeriods = hasPermission(user.permissions, PERMISSIONS.financialPeriodsRead);

  const [summary, warehouses, financialPeriodsPage] = await Promise.all([
    api.getOne('dashboard/summary'),
    hasPermission(user.permissions, PERMISSIONS.warehousesRead)
      ? api.list('warehouses', { limit: 200 })
      : Promise.resolve([]),
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

  const today = new Date();
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
  const todayDate = today.toISOString().slice(0, 10);

  const canCustomers = hasPermission(user.permissions, PERMISSIONS.customersRead);
  const canSalesInvoices = hasPermission(user.permissions, PERMISSIONS.salesInvoicesRead);
  const canSalesReturns = hasPermission(user.permissions, PERMISSIONS.salesReturnsRead);
  const canSalesReports = hasPermission(user.permissions, PERMISSIONS.reportsSales);
  const canSuppliers = hasPermission(user.permissions, PERMISSIONS.suppliersRead);
  const canPurchaseInvoices = hasPermission(user.permissions, PERMISSIONS.purchaseInvoicesRead);
  const canReceivables = hasPermission(user.permissions, PERMISSIONS.reportsReceivables);
  const canPayables = hasPermission(user.permissions, PERMISSIONS.reportsPayables);
  const canItems = hasPermission(user.permissions, PERMISSIONS.itemsRead);
  const canWarehouses = hasPermission(user.permissions, PERMISSIONS.warehousesRead);
  const canStockRead = hasPermission(user.permissions, PERMISSIONS.stockRead);
  const canReceiptActions = hasPermission(user.permissions, PERMISSIONS.salesInvoicesPay);
  const canPaymentActions = hasPermission(user.permissions, PERMISSIONS.purchaseInvoicesPay);

  const canSalesHub = hasPermission(user.permissions, [
    PERMISSIONS.customersRead,
    PERMISSIONS.salesInvoicesRead,
    PERMISSIONS.salesInvoicesManage,
    PERMISSIONS.salesReturnsRead,
    PERMISSIONS.reportsSales,
  ]);
  const canPurchaseHub = hasPermission(user.permissions, [
    PERMISSIONS.suppliersRead,
    PERMISSIONS.purchaseInvoicesRead,
    PERMISSIONS.purchaseInvoicesManage,
  ]);
  const canFinanceHub = hasPermission(user.permissions, [
    PERMISSIONS.reportsReceivables,
    PERMISSIONS.reportsPayables,
    PERMISSIONS.salesInvoicesPay,
    PERMISSIONS.purchaseInvoicesPay,
  ]);
  const canStockHub = hasPermission(user.permissions, [
    PERMISSIONS.itemsRead,
    PERMISSIONS.warehousesRead,
    PERMISSIONS.stockRead,
    PERMISSIONS.stockAdjust,
  ]);

  const totalCritical =
    Number(summary.critical?.receivables?.overdueCount ?? 0) +
    Number(summary.critical?.receivables?.dueTodayCount ?? 0) +
    Number(summary.critical?.payables?.overdueCount ?? 0) +
    Number(summary.critical?.payables?.dueTodayCount ?? 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Ballina</h1>
        <p className="mt-1 text-sm text-slate-500">
          Pamja e pergjithshme tani eshte e organizuar sipas domeneve: shitje, blerje,
          financa dhe stok.
        </p>
      </div>

      {totalCritical > 0 ? (
        <div className="rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 to-amber-50 p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-red-800">
                Ka {totalCritical} dokumente kritike qe kerkojne veprim sot.
              </p>
              <p className="mt-1 text-sm text-red-700">
                Rastet me vonese dhe ato qe skadojne sot po mbahen te ndara nen domenin
                financiar.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canFinanceHub ? (
                <Link
                  href="/financa"
                  className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:text-red-900"
                >
                  Hap financat
                </Link>
              ) : null}
              {canReceivables ? (
                <Link
                  href="/arketime"
                  className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:text-red-900"
                >
                  Hap arketimet
                </Link>
              ) : null}
              {canPayables ? (
                <Link
                  href="/pagesat"
                  className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:text-red-900"
                >
                  Hap pagesat
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-sm font-semibold text-emerald-800">
            Nuk ka dokumente kritike ne dashboard per momentin.
          </p>
          <p className="mt-1 text-sm text-emerald-700">
            Rastet financiare me prioritet do te shfaqen te ndara ne seksionin e Financave.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {canSalesHub ? (
          <DomainActionCard
            title="Shitja"
            description="Klientet, POS-i, faturat e shitjes, kthimet dhe raportimi tregtar."
            href="/shitja"
            badge="Domain"
            tone="indigo"
          />
        ) : null}
        {canPurchaseHub ? (
          <DomainActionCard
            title="Blerja"
            description="Furnitoret dhe dokumentet e blerjes, te ndara nga pagesat dhe aging-u."
            href="/blerja"
            badge="Domain"
            tone="emerald"
          />
        ) : null}
        {canFinanceHub ? (
          <DomainActionCard
            title="Financa"
            description="Arketimet, pagesat, rialokimet, due dates dhe raportet financiare."
            href="/financa"
            badge="Domain"
            tone="amber"
          />
        ) : null}
        {canStockHub ? (
          <DomainActionCard
            title="Artikuj & Stoku"
            description="Artikujt, magazinat, balancat materiale dhe operacionet e stokut."
            href="/stoku"
            badge="Domain"
            tone="slate"
          />
        ) : null}
      </div>

      {canSalesHub ? (
        <section className="space-y-4">
          <DashboardSection
            title="Shitja"
            description="Pjesa tregtare e ERP-se: klientet, dokumentet e shitjes dhe kthimet."
            href="/shitja"
          />
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatsCard
              title="Klientet"
              value={summary.counts.customers}
              href={canCustomers ? '/customers' : undefined}
            />
            <StatsCard
              title="Faturat e Shitjes"
              value={summary.counts.salesInvoices}
              href={canSalesInvoices ? '/sales-invoices' : undefined}
            />
            <StatsCard
              title="Kthimet e Shitjes"
              value={summary.counts.salesReturns}
              href={canSalesReturns ? '/sales-returns' : undefined}
            />
            <StatsCard
              title="Shitje te Postuara"
              value={fmtMoney(summary.totals.postedSales)}
              href={canSalesReports ? '/raportet/shitje' : undefined}
              subtitle={canSalesReports ? 'Kalimi te raportet e shitjes' : undefined}
            />
          </div>
        </section>
      ) : null}

      {canPurchaseHub ? (
        <section className="space-y-4">
          <DashboardSection
            title="Blerja"
            description="Furnitoret dhe dokumentet hyrese te organizuara si domen operativ me vete."
            href="/blerja"
          />
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatsCard
              title="Furnitoret"
              value={summary.counts.suppliers}
              href={canSuppliers ? '/suppliers' : undefined}
            />
            <StatsCard
              title="Faturat e Blerjes"
              value={summary.counts.purchaseInvoices}
              href={canPurchaseInvoices ? '/purchase-invoices' : undefined}
            />
            <StatsCard
              title="Blerje te Postuara"
              value={fmtMoney(summary.totals.postedPurchases)}
              href={canPurchaseInvoices ? '/purchase-invoices' : undefined}
            />
            <StatsCard
              title="Detyrime te Lidhura"
              value={fmtMoney(summary.outstanding.payables)}
              subtitle="Menaxhohen te Financa"
              href={canFinanceHub ? '/financa' : undefined}
            />
          </div>
        </section>
      ) : null}

      {canFinanceHub ? (
        <section className="space-y-4">
          <DashboardSection
            title="Financa"
            description="Receivables, payables, cashflow dhe dokumentet kritike te ndara nga shitja dhe blerja."
            href="/financa"
          />

          {canFinancialPeriods && currentFinancialPeriodSummary ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Month-end: {currentFinancialPeriodSummary.period.label}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {currentFinancialPeriodSummary.checklist.periodReadyToClose
                      ? 'Periudha aktuale eshte gati per soft-close ose close.'
                      : 'Ka blockers aktive ne aging, unapplied balances ose pajtim bankar.'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge value={currentFinancialPeriodSummary.period.status} />
                  <Link
                    href="/financa/periudhat"
                    className="inline-flex rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Hap periudhat
                  </Link>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
                <StatsCard
                  title="Blockers"
                  value={currentFinancialPeriodSummary.checklist.blockerCount}
                  subtitle="Checklist e mbylljes"
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
            </div>
          ) : null}

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatsCard
              title="Arketime te Hapura"
              value={fmtMoney(summary.outstanding.receivables)}
              subtitle={buildAgingSubtitle(summary.aging?.receivables ?? {})}
              href={canReceivables ? '/arketime' : undefined}
            />
            <StatsCard
              title="Detyrime te Hapura"
              value={fmtMoney(summary.outstanding.payables)}
              subtitle={buildAgingSubtitle(summary.aging?.payables ?? {})}
              href={canPayables ? '/pagesat' : undefined}
            />
            <StatsCard
              title="Arketime Kete Muaj"
              value={fmtMoney(summary.cashflow?.receiptsMonth ?? 0)}
              subtitle="Te regjistruara nga pagesat e klienteve"
              href={canReceivables ? `/arketime?dateFrom=${monthStart}&dateTo=${todayDate}` : undefined}
            />
            <StatsCard
              title="Pagesa Kete Muaj"
              value={fmtMoney(summary.cashflow?.paymentsMonth ?? 0)}
              subtitle="Te regjistruara ndaj furnitoreve"
              href={canPayables ? `/pagesat?dateFrom=${monthStart}&dateTo=${todayDate}` : undefined}
            />
          </div>

          {(canSalesInvoices || canPurchaseInvoices) && totalCritical > 0 ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {canSalesInvoices ? (
                <ReminderPanel
                  title="Arketime Kritike"
                  description="Faturat e shitjes me vonese ose me afat sot, te renditura sipas prioritetit."
                  items={[
                    ...(summary.critical?.receivables?.overdue ?? []),
                    ...(summary.critical?.receivables?.dueToday ?? []),
                  ]}
                  detailBasePath="/sales-invoices"
                  actionBasePath={canReceiptActions ? '/arketime/new' : undefined}
                  actionLabel={canReceiptActions ? 'Regjistro arketim' : undefined}
                />
              ) : null}

              {canPurchaseInvoices ? (
                <ReminderPanel
                  title="Pagesa Kritike"
                  description="Faturat e blerjes me vonese ose me afat sot, per t'u trajtuar sa me shpejt."
                  items={[
                    ...(summary.critical?.payables?.overdue ?? []),
                    ...(summary.critical?.payables?.dueToday ?? []),
                  ]}
                  detailBasePath="/purchase-invoices"
                  actionBasePath={canPaymentActions ? '/pagesat/new' : undefined}
                  actionLabel={canPaymentActions ? 'Regjistro pagese' : undefined}
                />
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {canStockHub ? (
        <section className="space-y-4">
          <DashboardSection
            title="Artikuj & Stoku"
            description="Artikujt, magazinat dhe levizjet materiale te ndara si domain operacional i pavarur."
            href="/stoku"
          />
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatsCard
              title="Artikujt"
              value={summary.counts.items}
              href={canItems ? '/items' : undefined}
            />
            <StatsCard
              title="Magazinat"
              value={warehouses.length}
              href={canWarehouses ? '/warehouses' : undefined}
            />
            <StatsCard
              title="Linjat e Stokut"
              value={summary.counts.stockLines}
              href={canStockRead ? '/stock/balances' : undefined}
            />
            <StatsCard
              title="Raportet e Stokut"
              value="Hap"
              href={canStockRead ? '/raportet/stoku' : undefined}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
