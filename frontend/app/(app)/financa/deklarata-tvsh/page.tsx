import { PageHeader } from '@/components/page-header';
import { VatReturnsClient } from '@/components/accounting/vat-returns-client';
import type {
  VatFinancialPeriodsPage,
  VatReturnsPage,
  VatReturnPreview,
} from '@/components/accounting/vat-returns-client';
import { api } from '@/lib/api';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function VatReturnsPage() {
  const user = await requirePagePermission(PERMISSIONS.accountingRead);
  const currentYear = new Date().getUTCFullYear();
  const canManage = hasPermission(user.permissions, PERMISSIONS.accountingManage);

  const [periodsPage, returnsPage] = await Promise.all([
    api.query<VatFinancialPeriodsPage>('financial-periods', { year: currentYear }),
    api.query<VatReturnsPage>('vat-returns', { year: currentYear }),
  ]);

  const currentPeriodId = periodsPage.currentPeriodId ?? periodsPage.items[0]?.id ?? null;
  const initialPreview = currentPeriodId
    ? await api.fetch<VatReturnPreview>(`/vat-returns/preview?financialPeriodId=${currentPeriodId}`)
    : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Deklarata Mujore e TVSH-se"
        description="Deklarata mujore e bazuar ne settlement-in e TVSH-se, me filing, export dhe snapshot te auditueshem per arkive."
      />
      <VatReturnsClient
        initialYear={currentYear}
        initialPeriods={periodsPage}
        initialReturns={returnsPage}
        initialPreview={initialPreview}
        canManage={canManage}
      />
    </div>
  );
}
