import { BankReconciliationClient } from '@/components/finance/bank-reconciliation-client';
import { PageHeader } from '@/components/page-header';
import { api } from '@/lib/api';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function BankReconciliationPage() {
  const user = await requirePagePermission(PERMISSIONS.financeAccountsRead);

  const bankAccounts = await api.list('finance-accounts', {
    accountType: 'BANK',
    isActive: true,
    limit: 100,
    sortBy: 'name',
    sortOrder: 'asc',
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pajtimi Bankar"
        description="Perputh levizjet e statement-it bankar me ledger-in financiar te arketimit, pageses dhe transaksioneve manuale."
        createHref="/financa/pajtimi-bankar/new"
        createLabel="Levizje bankare"
        createPermission={PERMISSIONS.financeAccountsManage}
      />

      <BankReconciliationClient
        bankAccounts={bankAccounts}
        canManage={hasPermission(user.permissions, PERMISSIONS.financeAccountsManage)}
      />
    </div>
  );
}
