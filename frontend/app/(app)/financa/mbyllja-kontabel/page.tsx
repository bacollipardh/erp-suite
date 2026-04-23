import { PageHeader } from '@/components/page-header';
import { ClosingEntriesClient } from '@/components/accounting/closing-entries-client';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

type FinancialPeriodsPage = {
  items: Array<{
    id: string;
    key: string;
    label: string;
    year: number;
    month: number;
    periodStart: string;
    periodEnd: string;
    status: 'OPEN' | 'SOFT_CLOSED' | 'CLOSED';
  }>;
  currentPeriodId?: string | null;
};

export default async function ClosingEntriesPage() {
  await requirePagePermission(PERMISSIONS.accountingManage);

  const currentYear = new Date().getUTCFullYear();
  const periodsPage = await api.listPage<FinancialPeriodsPage>('financial-periods', {
    year: currentYear,
  });
  const initialPeriodId = periodsPage.currentPeriodId ?? periodsPage.items[0]?.id ?? null;
  const initialPreview = initialPeriodId
    ? await api.query<any>('accounting/closing-entry-preview', {
        financialPeriodId: initialPeriodId,
      })
    : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Mbyllja Kontabel"
        description="Preview dhe gjenerim i closing entry per fund-muaj, duke kaluar rezultatin e periudhes te retained earnings."
      />
      <ClosingEntriesClient
        initialPeriods={periodsPage}
        initialPreview={initialPreview as any}
        canManage
      />
    </div>
  );
}
