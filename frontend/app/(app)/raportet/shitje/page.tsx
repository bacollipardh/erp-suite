import Link from 'next/link';
import { SalesReportClient } from '@/components/reports/sales-report-client';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function SalesReportsPage() {
  await requirePagePermission(PERMISSIONS.reportsSales);

  const [customers, users] = await Promise.all([
    api.list('customers', { limit: 100, sortBy: 'name', sortOrder: 'asc' }),
    api.list('users', { limit: 100 }),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Raportet e Shitjes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Te gjitha metrikat tregtare dhe performanca e shitjes te ndara nga receivables, payables dhe aktiviteti financiar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/sales-invoices"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Hap faturat e shitjes
          </Link>
          <Link
            href="/raportet"
            className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:text-indigo-900"
          >
            Kthehu te qendra e raporteve
          </Link>
        </div>
      </div>

      <SalesReportClient customers={customers} users={users} />
    </div>
  );
}
