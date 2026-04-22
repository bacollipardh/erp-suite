import { PaymentActivityClient } from '@/components/finance/payment-activity-client';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function ReceiptsPage() {
  await requirePagePermission(PERMISSIONS.reportsReceivables);

  const customers = await api.list('customers', {
    limit: 200,
    sortBy: 'name',
    sortOrder: 'asc',
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Arketimet</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Aktiviteti i plote i arketimeve me filtra, status pas pageses dhe lidhje direkte me faturat e shitjes.
        </p>
      </div>

      <PaymentActivityClient
        title="Arketimet e klienteve"
        description="Kontrollo pagesat e regjistruara, mbetjet pas arketimit dhe dokumentet e lidhura."
        endpoint="reports/receipts-activity"
        parties={customers}
        partyLabel="Klienti"
        partyQueryKey="customerId"
        documentBasePath="/sales-invoices"
        emptyText="Nuk ka arketime per filtrat e zgjedhur."
      />
    </div>
  );
}
