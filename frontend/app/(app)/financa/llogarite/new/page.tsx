import { PageHeader } from '@/components/page-header';
import { FinanceAccountForm } from '@/components/finance/finance-account-form';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function NewFinanceAccountPage() {
  await requirePagePermission(PERMISSIONS.financeAccountsManage);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Llogari e Re Cash / Bank"
        description="Krijo nje burim te ri likuiditeti qe do te perdoret ne arketime, pagesa dhe transfere."
      />
      <FinanceAccountForm />
    </div>
  );
}
