import {
  FinancialPeriodsClient,
} from '@/components/finance/financial-periods-client';
import type {
  FinancialPeriodSummary,
  FinancialPeriodsPage as FinancialPeriodsPagePayload,
} from '@/components/finance/financial-periods-client';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { api } from '@/lib/api';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function FinancialPeriodsPage() {
  const user = await requirePagePermission(PERMISSIONS.financialPeriodsRead);
  const initialYear = new Date().getUTCFullYear();
  const periodsPage = await api.listPage<FinancialPeriodsPagePayload>('financial-periods', {
    year: initialYear,
  });
  const initialSummary = periodsPage.currentPeriodId
    ? await api.fetch<FinancialPeriodSummary>(
        `/financial-periods/${periodsPage.currentPeriodId}/summary`,
      )
    : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Periudhat Financiare</h1>
        <p className="mt-1 text-sm text-slate-500">
          Monthly close control per shitje, blerje, arketime, pagesa, treasury dhe pajtim bankar.
        </p>
      </div>

      <FinancialPeriodsClient
        initialYear={initialYear}
        initialPeriods={periodsPage}
        initialSummary={initialSummary}
        canManage={hasPermission(user.permissions, PERMISSIONS.financialPeriodsManage)}
      />
    </div>
  );
}
