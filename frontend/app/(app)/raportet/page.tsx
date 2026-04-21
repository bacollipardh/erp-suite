import { api } from '@/lib/api';
import { SalesReportClient } from '@/components/reports/sales-report-client';

export default async function ReportsPage() {
  const [invoices, customers, users] = await Promise.all([
    api.list('sales-invoices'),
    api.list('customers'),
    api.list('users'),
  ]);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">Raportet e Shitjeve</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Analiza e shitjeve sipas periudhës, blerësit dhe agjentit.
        </p>
      </div>
      <SalesReportClient
        invoices={invoices}
        customers={customers}
        users={users}
      />
    </div>
  );
}
