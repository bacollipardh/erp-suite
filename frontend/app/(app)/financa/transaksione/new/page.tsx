import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { FinanceTransactionForm } from '@/components/finance/finance-transaction-form';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function NewFinanceTransactionPage() {
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
        title="Transaksion Financiar"
        description="Regjistro hyrje ose dalje manuale ne nje llogari ekzistuese."
      />

      {accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500 shadow-sm">
          Nuk ka ende llogari aktive. Krijo fillimisht nje llogari te re te finances nga{' '}
          <Link href="/financa/llogarite/new" className="font-medium text-indigo-700 hover:text-indigo-900">
            kjo faqe
          </Link>
          .
        </div>
      ) : (
        <FinanceTransactionForm accounts={accounts} />
      )}
    </div>
  );
}
