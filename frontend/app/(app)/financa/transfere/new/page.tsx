import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { FinanceTransferForm } from '@/components/finance/finance-transfer-form';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function NewFinanceTransferPage() {
  await requirePagePermission(PERMISSIONS.financeAccountsManage);

  const accounts = await api.list('finance-accounts', {
    isActive: true,
    limit: 100,
    sortBy: 'name',
    sortOrder: 'asc',
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Transfer Financiar"
        description="Leviz fondet mes llogarive cash dhe bankare me gjurme te plote ne ledger."
      />

      {accounts.length < 2 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500 shadow-sm">
          Duhen se paku dy llogari aktive per te kryer transfer. Krijo llogari te re nga{' '}
          <Link href="/financa/llogarite/new" className="font-medium text-indigo-700 hover:text-indigo-900">
            kjo faqe
          </Link>
          .
        </div>
      ) : (
        <FinanceTransferForm accounts={accounts} />
      )}
    </div>
  );
}
