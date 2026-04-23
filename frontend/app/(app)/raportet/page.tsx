import Link from 'next/link';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { requireAnyPagePermission } from '@/lib/server-page-auth';

function ReportHubCard({
  title,
  description,
  href,
  badge,
}: {
  title: string;
  description: string;
  href: string;
  badge: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700">
            {badge}
          </span>
          <h2 className="mt-3 text-lg font-semibold text-slate-900 group-hover:text-indigo-800">
            {title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
        </div>
        <span className="text-slate-300 transition-colors group-hover:text-indigo-500">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.8}
            stroke="currentColor"
            className="h-5 w-5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5l6 7.5-6 7.5M19.5 12h-15" />
          </svg>
        </span>
      </div>
    </Link>
  );
}

export default async function ReportsHubPage() {
  const user = await requireAnyPagePermission([
    PERMISSIONS.reportsSales,
    PERMISSIONS.reportsReceivables,
    PERMISSIONS.reportsPayables,
    PERMISSIONS.reportsAccounting,
    PERMISSIONS.stockRead,
  ]);

  const canSales = hasPermission(user.permissions, PERMISSIONS.reportsSales);
  const canFinance = hasPermission(user.permissions, [
    PERMISSIONS.reportsReceivables,
    PERMISSIONS.reportsPayables,
  ]);
  const canAccounting = hasPermission(user.permissions, PERMISSIONS.reportsAccounting);
  const canStock = hasPermission(user.permissions, PERMISSIONS.stockRead);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Qendra e Raporteve</h1>
        <p className="mt-1 text-sm text-slate-500">
          Raportet jane ndare sipas domenit qe navigimi te jete me i qarte: shitja me vete dhe financa me vete.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {canSales ? (
          <ReportHubCard
            title="Raportet e Shitjes"
            badge="Shitja"
            href="/raportet/shitje"
            description="Analiza e faturave te shitjes, trendet mujore, top klientet, top agjentet dhe lista e faturave te fundit."
          />
        ) : null}

        {canFinance ? (
          <ReportHubCard
            title="Raportet Financiare"
            badge="Financa"
            href="/raportet/financa"
            description="Receivables, payables, aging, exposure, arketimet dhe pagesat e fundit me filtra te ndare nga raportet e shitjes."
          />
        ) : null}
        {canAccounting ? (
          <ReportHubCard
            title="Raportet Kontabel"
            badge="Kontabiliteti"
            href="/raportet/kontabiliteti"
            description="Trial balance, profit & loss dhe balance sheet mbi journal entries te gjeneruara nga shitja, blerja, financa dhe stoku."
          />
        ) : null}
        {canStock ? (
          <ReportHubCard
            title="Raportet e Stokut"
            badge="Stoku"
            href="/raportet/stoku"
            description="Gjendja e stokut, levizjet materiale dhe qasja e ndare e raportimit per artikujt dhe magazinat."
          />
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Parimi i organizimit</h2>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-slate-600">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="font-medium text-slate-900">Shitja</p>
            <p className="mt-1">
              Faturat e shitjes, kthimet, POS-i dhe raportet e performaces tregtare qendrojne ne nje domain te ndare.
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="font-medium text-slate-900">Financa</p>
            <p className="mt-1">
              Arketimet, pagesat, rialokimet, aging dhe exposure qendrojne te gjitha ne nje domain financiar te vecuar.
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="font-medium text-slate-900">Kontabiliteti</p>
            <p className="mt-1">
              Libri kontabel, journal entries dhe pasqyrat financiare jane shtresa kontabel e vecuar mbi operacionet.
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="font-medium text-slate-900">Stoku & Materialet</p>
            <p className="mt-1">
              Balancat, levizjet dhe operacionet materiale po ndahen si domain i trete i raportimit, i pavarur nga shitja dhe financa.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
