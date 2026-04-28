import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { BankReconciliationReportClient } from '@/components/reports/bank-reconciliation-report-client';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function BankReconciliationReportsPage() {
  await requirePagePermission(PERMISSIONS.financeAccountsRead);
  const bankAccounts = await api.list('finance-accounts', {
    accountType: 'BANK',
    isActive: true,
    limit: 100,
    sortBy: 'name',
    sortOrder: 'asc',
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader
          title="Raporti i Pajtimit Bankar"
          description="Raport i vecuar per statement lines, matched/unmatched dhe diferencat e pajtimit bankar."
        />
        <div className="flex flex-wrap gap-2">
          <Link
            href="/financa/pajtimi-bankar"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Hap pajtimin bankar
          </Link>
          <Link
            href="/raportet/financa"
            className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:text-indigo-900"
          >
            Kthehu te raportet financiare
          </Link>
        </div>
      </div>

      <BankReconciliationReportClient bankAccounts={bankAccounts} />
    </div>
  );
}
