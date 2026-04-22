import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { PaymentActivityClient } from '@/components/finance/payment-activity-client';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function SupplierPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePagePermission(PERMISSIONS.reportsPayables);
  const query = await searchParams;

  const suppliers = await api.list('suppliers', {
    limit: 200,
    sortBy: 'name',
    sortOrder: 'asc',
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pagesat"
        description="Aktiviteti i plote i pagesave ndaj furnitoreve me filtra, status dhe qasje direkte te dokumentet e blerjes."
        createHref="/pagesat/new"
        createLabel="Pagese e re"
        createPermission={PERMISSIONS.purchaseInvoicesPay}
      />

      <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-indigo-900">Ke balance unapplied per t'u rialokuar?</p>
            <p className="mt-1 text-sm text-indigo-800/80">
              Hape workflow-in e rialokimit kur nje pagese ka teprice qe duhet aplikuar me vone te nje fature tjeter te te njejtit furnitor.
            </p>
          </div>
          <Link
            href="/pagesat/rialokime"
            className="inline-flex rounded-lg border border-indigo-300 bg-white px-3 py-2 text-sm font-medium text-indigo-700 hover:text-indigo-900"
          >
            Hap rialokimet
          </Link>
        </div>
      </div>

      <PaymentActivityClient
        title="Pagesat ndaj furnitoreve"
        description="Shiko kush eshte paguar, sa ka mbetur pas pageses dhe cila fature eshte prekur."
        endpoint="reports/supplier-payments-activity"
        exportKind="supplier-payments"
        parties={suppliers}
        partyLabel="Furnitori"
        partyQueryKey="supplierId"
        documentBasePath="/purchase-invoices"
        emptyText="Nuk ka pagesa per filtrat e zgjedhur."
        initialFilters={{
          search: typeof query.search === 'string' ? query.search : '',
          partyId: typeof query.supplierId === 'string' ? query.supplierId : '',
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
