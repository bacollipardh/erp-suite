import Link from 'next/link';
import { BankReconciliationReportClient } from '@/components/reports/bank-reconciliation-report-client';
import { ReportsClient } from '@/components/reports/reports-client';
import { api } from '@/lib/api';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { requireAnyPagePermission } from '@/lib/server-page-auth';

export default async function FinanceReportsPage() {
  const user = await requireAnyPagePermission([
    PERMISSIONS.reportsReceivables,
    PERMISSIONS.reportsPayables,
    PERMISSIONS.financeAccountsRead,
  ]);

  const canReceivables = hasPermission(user.permissions, PERMISSIONS.reportsReceivables);
  const canPayables = hasPermission(user.permissions, PERMISSIONS.reportsPayables);
  const canFinanceAccounts = hasPermission(user.permissions, PERMISSIONS.financeAccountsRead);

  const [customers, suppliers, bankAccounts] = await Promise.all([
    canReceivables
      ? api.list('customers', { limit: 100, sortBy: 'name', sortOrder: 'asc' })
      : Promise.resolve([]),
    canPayables
      ? api.list('suppliers', { limit: 100, sortBy: 'name', sortOrder: 'asc' })
      : Promise.resolve([]),
    canFinanceAccounts
      ? api.list('finance-accounts', {
          accountType: 'BANK',
          isActive: true,
          limit: 100,
          sortBy: 'name',
          sortOrder: 'asc',
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Raportet Financiare</h1>
          <p className="mt-1 text-sm text-slate-500">
            Receivables, payables, aging, exposure, pajtim bankar, arketime dhe pagesa te ndara qarte nga raportimi i shitjes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canReceivables ? (
            <Link
              href="/arketime"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Hap arketimet
            </Link>
          ) : null}
          {canPayables ? (
            <Link
              href="/pagesat"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Hap pagesat
            </Link>
          ) : null}
          {canFinanceAccounts ? (
            <Link
              href="/financa/pajtimi-bankar"
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:text-emerald-900"
            >
              Hap pajtimin bankar
            </Link>
          ) : null}
          <Link
            href="/raportet"
            className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:text-indigo-900"
          >
            Kthehu te qendra e raporteve
          </Link>
        </div>
      </div>

      {canFinanceAccounts ? (
        <BankReconciliationReportClient bankAccounts={bankAccounts} />
      ) : null}

      {canReceivables || canPayables ? (
        <ReportsClient
          customers={customers}
          suppliers={suppliers}
          users={[]}
          includeSales={false}
          includeReceivables={canReceivables}
          includePayables={canPayables}
        />
      ) : null}
    </div>
  );
}
