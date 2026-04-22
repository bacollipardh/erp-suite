import Link from 'next/link';
import { DueStateReminder } from '@/components/finance/due-state-reminder';
import { StatsCard } from '@/components/stats-card';
import { StatusBadge } from '@/components/status-badge';
import { api } from '@/lib/api';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

function fmtMoney(value: number) {
  return `${value.toLocaleString('sq-AL', {
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
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
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
                    Afati: {formatDate(item.dueDate)} | Mbetur: {fmtMoney(Number(item.outstandingAmount ?? 0))}
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
  const summary = await api.getOne('dashboard/summary');
  const today = new Date();
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
  const todayDate = today.toISOString().slice(0, 10);
  const canSalesDetails = hasPermission(user.permissions, PERMISSIONS.salesInvoicesRead);
  const canPurchaseDetails = hasPermission(user.permissions, PERMISSIONS.purchaseInvoicesRead);
  const canReceiptActions = hasPermission(user.permissions, PERMISSIONS.salesInvoicesPay);
  const canPaymentActions = hasPermission(user.permissions, PERMISSIONS.purchaseInvoicesPay);
  const totalCritical =
    Number(summary.critical?.receivables?.overdueCount ?? 0) +
    Number(summary.critical?.receivables?.dueTodayCount ?? 0) +
    Number(summary.critical?.payables?.overdueCount ?? 0) +
    Number(summary.critical?.payables?.dueTodayCount ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Ballina</h1>
        <p className="text-sm text-slate-500 mt-1">Pamje e pergjithshme e sistemit.</p>
      </div>

      {totalCritical > 0 ? (
        <div className="rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 to-amber-50 p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-red-800">
                Ka {totalCritical} dokumente kritike qe kerkojne veprim sot.
              </p>
              <p className="mt-1 text-sm text-red-700">
                Dashboard-i po i sjell automatikisht rastet me vonese dhe ato qe skadojne sot.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canSalesDetails ? (
                <Link
                  href="/arketime"
                  className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:text-red-900"
                >
                  Hap arketimet
                </Link>
              ) : null}
              {canPurchaseDetails ? (
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
            Dokumentet me vonese dhe ato qe skadojne sot do te shfaqen ketu automatikisht.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard title="Artikujt" value={summary.counts.items} />
        <StatsCard title="Furnitoret" value={summary.counts.suppliers} />
        <StatsCard title="Klientet" value={summary.counts.customers} />
        <StatsCard title="Linjat e Stokut" value={summary.counts.stockLines} />
        <StatsCard title="Faturat e Blerjes" value={summary.counts.purchaseInvoices} />
        <StatsCard title="Faturat e Shitjes" value={summary.counts.salesInvoices} />
        <StatsCard title="Kthimet e Shitjes" value={summary.counts.salesReturns} />
        <StatsCard
          title="Arketime te Hapura"
          value={fmtMoney(Number(summary.outstanding.receivables ?? 0))}
          subtitle={buildAgingSubtitle(summary.aging?.receivables ?? {})}
          href="/arketime"
        />
        <StatsCard
          title="Detyrime te Hapura"
          value={fmtMoney(Number(summary.outstanding.payables ?? 0))}
          subtitle={buildAgingSubtitle(summary.aging?.payables ?? {})}
          href="/pagesat"
        />
        <StatsCard
          title="Arketime Kete Muaj"
          value={fmtMoney(Number(summary.cashflow?.receiptsMonth ?? 0))}
          subtitle="Te regjistruara nga pagesat e klienteve"
          href={`/arketime?dateFrom=${monthStart}&dateTo=${todayDate}`}
        />
        <StatsCard
          title="Pagesa Kete Muaj"
          value={fmtMoney(Number(summary.cashflow?.paymentsMonth ?? 0))}
          subtitle="Te regjistruara ndaj furnitoreve"
          href={`/pagesat?dateFrom=${monthStart}&dateTo=${todayDate}`}
        />
        <StatsCard
          title="Shitje te Postuara"
          value={fmtMoney(Number(summary.totals.postedSales ?? 0))}
        />
        <StatsCard
          title="Blerje te Postuara"
          value={fmtMoney(Number(summary.totals.postedPurchases ?? 0))}
        />
        <StatsCard
          title="Kthime te Postuara"
          value={fmtMoney(Number(summary.totals.postedReturns ?? 0))}
        />
      </div>

      {(canSalesDetails || canPurchaseDetails) && totalCritical > 0 ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {canSalesDetails ? (
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

          {canPurchaseDetails ? (
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
    </div>
  );
}
