import { PageHeader } from '@/components/page-header';
import { PaymentActivityClient } from '@/components/finance/payment-activity-client';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePagePermission(PERMISSIONS.reportsReceivables);
  const query = await searchParams;

  const customers = await api.list('customers', {
    limit: 200,
    sortBy: 'name',
    sortOrder: 'asc',
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Arketimet"
        description="Aktiviteti i plote i arketimeve me filtra, status pas pageses dhe lidhje direkte me faturat e shitjes."
        createHref="/arketime/new"
        createLabel="Arketim i ri"
        createPermission={PERMISSIONS.salesInvoicesPay}
      />

      <PaymentActivityClient
        title="Arketimet e klienteve"
        description="Kontrollo pagesat e regjistruara, mbetjet pas arketimit dhe dokumentet e lidhura."
        endpoint="reports/receipts-activity"
        exportKind="receipts"
        parties={customers}
        partyLabel="Klienti"
        partyQueryKey="customerId"
        documentBasePath="/sales-invoices"
        emptyText="Nuk ka arketime per filtrat e zgjedhur."
        initialFilters={{
          search: typeof query.search === 'string' ? query.search : '',
          partyId: typeof query.customerId === 'string' ? query.customerId : '',
          dateFrom: typeof query.dateFrom === 'string' ? query.dateFrom : '',
          dateTo: typeof query.dateTo === 'string' ? query.dateTo : '',
          statusAfter: typeof query.statusAfter === 'string' ? query.statusAfter : '',
          minAmount: typeof query.minAmount === 'string' ? query.minAmount : '',
          maxAmount: typeof query.maxAmount === 'string' ? query.maxAmount : '',
          sortBy: typeof query.sortBy === 'string' ? query.sortBy : 'paidAt',
          sortOrder:
            query.sortOrder === 'asc' || query.sortOrder === 'desc' ? query.sortOrder : 'desc',
          page: typeof query.page === 'string' ? Number(query.page) || 1 : 1,
        }}
      />
    </div>
  );
}
