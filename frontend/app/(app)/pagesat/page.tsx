import { PaymentActivityClient } from '@/components/finance/payment-activity-client';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function SupplierPaymentsPage() {
  await requirePagePermission(PERMISSIONS.reportsPayables);

  const suppliers = await api.list('suppliers', {
    limit: 200,
    sortBy: 'name',
    sortOrder: 'asc',
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Pagesat</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Aktiviteti i plote i pagesave ndaj furnitoreve me filtra, status dhe qasje direkte te dokumentet e blerjes.
        </p>
      </div>

      <PaymentActivityClient
        title="Pagesat ndaj furnitoreve"
        description="Shiko kush eshte paguar, sa ka mbetur pas pageses dhe cila fature eshte prekur."
        endpoint="reports/supplier-payments-activity"
        parties={suppliers}
        partyLabel="Furnitori"
        partyQueryKey="supplierId"
        documentBasePath="/purchase-invoices"
        emptyText="Nuk ka pagesa per filtrat e zgjedhur."
      />
    </div>
  );
}
