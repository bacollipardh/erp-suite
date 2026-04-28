import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { ReportsClient } from '@/components/reports/reports-client';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function ReceivablesReportsPage() {
  await requirePagePermission(PERMISSIONS.reportsReceivables);
  const customers = await api.list('customers', {
    limit: 100,
    sortBy: 'name',
    sortOrder: 'asc',
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader
          title="Raporti i Arketimeve"
          description="Receivables aging, debtor exposure dhe arketimet e fundit."
        />
        <div className="flex flex-wrap gap-2">
          <Link
            href="/arketime"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Hap arketimet
          </Link>
          <Link
            href="/raportet/financa"
            className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:text-indigo-900"
          >
            Kthehu te raportet financiare
          </Link>
        </div>
      </div>

      <ReportsClient
        customers={customers}
        suppliers={[]}
        users={[]}
        includeSales={false}
        includeReceivables
        includePayables={false}
      />
    </div>
  );
}
