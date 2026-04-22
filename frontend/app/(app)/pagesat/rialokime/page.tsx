import Link from 'next/link';
import { SettlementReallocationClient } from '@/components/finance/settlement-reallocation-client';
import { PageHeader } from '@/components/page-header';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function SupplierPaymentReallocationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePagePermission(PERMISSIONS.purchaseInvoicesPay);
  const query = await searchParams;

  const suppliers = await api.list('suppliers', {
    limit: 200,
    sortBy: 'name',
    sortOrder: 'asc',
  });

  const initialSearch = typeof query.search === 'string' ? query.search : '';
  const initialSupplierId = typeof query.supplierId === 'string' ? query.supplierId : '';
  const initialStatus =
    query.status === 'ALL' ||
    query.status === 'OPEN' ||
    query.status === 'PARTIALLY_ALLOCATED' ||
    query.status === 'FULLY_ALLOCATED'
      ? query.status
      : 'OPEN';

  return (
    <div className="space-y-5">
      <PageHeader
        title="Rialokimi i Pagesave"
        description="Apliko balance `unapplied` nga pagesat ekzistuese te dokumente te tjera te te njejtit furnitor me ledger dhe audit trail te plote."
        createHref="/pagesat/new"
        createLabel="Pagese e re"
        createPermission={PERMISSIONS.purchaseInvoicesPay}
      />

      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900">Workflow operativ per unapplied payments</p>
            <p className="mt-1 text-sm text-slate-500">
              Ketu rialokon tepricat e pagesave ekzistuese ne fatura te tjera te te njejtit furnitor, pa humbur historikun e burimit.
            </p>
          </div>
          <Link
            href="/pagesat"
            className="inline-flex rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Shko te aktiviteti i pagesave
          </Link>
        </div>
      </div>

      <SettlementReallocationClient
        mode="payment"
        parties={suppliers}
        endpointBase="finance-settlements/payments"
        partyLabel="Furnitori"
        documentBasePath="/purchase-invoices"
        activityHref="/pagesat"
        emptyText="Nuk ka balanca unapplied per furnitoret e filtruar."
        initialSearch={initialSearch}
        initialPartyId={initialSupplierId}
        initialStatus={initialStatus}
      />
    </div>
  );
}
