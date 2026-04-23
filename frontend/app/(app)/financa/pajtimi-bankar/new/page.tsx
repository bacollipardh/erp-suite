import Link from 'next/link';
import { BankStatementLineForm } from '@/components/finance/bank-statement-line-form';
import { PageHeader } from '@/components/page-header';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function NewBankStatementLinePage() {
  await requirePagePermission(PERMISSIONS.financeAccountsManage);

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
        title="Levizje Bankare"
        description="Regjistro nje rresht nga statement-i bankar qe pastaj do te pajtohet me ledger-in financiar."
      />

      {bankAccounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500 shadow-sm">
          Nuk ka ende llogari bankare aktive. Krijo fillimisht nje llogari bankare nga{' '}
          <Link href="/financa/llogarite/new" className="font-medium text-indigo-700 hover:text-indigo-900">
            kjo faqe
          </Link>
          .
        </div>
      ) : (
        <BankStatementLineForm accounts={bankAccounts} />
      )}
    </div>
  );
}
