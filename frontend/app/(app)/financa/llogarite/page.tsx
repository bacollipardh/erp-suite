import { PageHeader } from '@/components/page-header';
import { FinanceAccountsOverviewClient } from '@/components/finance/finance-accounts-overview-client';
import { api } from '@/lib/api';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function FinanceAccountsPage() {
  const user = await requirePagePermission(PERMISSIONS.financeAccountsRead);

  const [accountsPage, transactionsPage] = await Promise.all([
    api.listPage('finance-accounts', {
      limit: 100,
      sortBy: 'name',
      sortOrder: 'asc',
    }),
    api.listPage('finance-accounts/transactions', {
      limit: 100,
      sortBy: 'transactionDate',
      sortOrder: 'desc',
    }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Llogarite Cash / Bank"
        description="Treasury layer i dedikuar per kasa, banka, transaksione manuale dhe transfere mes llogarive."
        createHref="/financa/llogarite/new"
        createLabel="Llogari e re"
        createPermission={PERMISSIONS.financeAccountsManage}
      />

      <FinanceAccountsOverviewClient
        accounts={accountsPage.items ?? []}
        summary={accountsPage.summary ?? {}}
        transactions={transactionsPage.items ?? []}
        transactionSummary={transactionsPage.summary ?? {}}
        canManage={hasPermission(user.permissions, PERMISSIONS.financeAccountsManage)}
      />
    </div>
  );
}
