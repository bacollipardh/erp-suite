import Link from 'next/link';
import {
  CashDailyCloseClient,
  type CashDailyCloseSummary,
} from '@/components/finance/cash-daily-close-client';
import { PageHeader } from '@/components/page-header';
import { api } from '@/lib/api';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

type SearchParams = Promise<{ date?: string }>;

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default async function CashDailyClosePage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const user = await requirePagePermission(PERMISSIONS.financeAccountsRead);
  const params = searchParams ? await searchParams : {};
  const date = params.date || today();
  const summary = await api.getOne<CashDailyCloseSummary>(
    `cash-daily-close/summary?date=${encodeURIComponent(date)}`,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader
          title="Mbyllja Ditore e Arkës"
          description="Hap ditën, kontrollo hyrjet/daljet, numëro cash-in fizik dhe regjistro diferencën e arkës."
        />
        <div className="flex flex-wrap gap-2">
          <Link
            href="/financa"
            className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:text-indigo-900"
          >
            Kthehu te financa
          </Link>
          <Link
            href="/financa/llogarite"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Llogaritë cash / bank
          </Link>
        </div>
      </div>

      <CashDailyCloseClient
        initialSummary={summary}
        canManage={hasPermission(user.permissions, PERMISSIONS.financeAccountsManage)}
      />
    </div>
  );
}
