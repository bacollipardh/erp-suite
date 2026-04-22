import Link from 'next/link';
import { SettlementReallocationClient } from '@/components/finance/settlement-reallocation-client';
import { PageHeader } from '@/components/page-header';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function ReceiptReallocationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePagePermission(PERMISSIONS.salesInvoicesPay);
  const query = await searchParams;

  const customers = await api.list('customers', {
    limit: 200,
    sortBy: 'name',
    sortOrder: 'asc',
  });

  const initialSearch = typeof query.search === 'string' ? query.search : '';
  const initialCustomerId = typeof query.customerId === 'string' ? query.customerId : '';
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
        title="Rialokimi i Arketimeve"
        description="Apliko balance `unapplied` nga arketimet ekzistuese te fatura te tjera te te njejtit klient me audit trail te plote."
        createHref="/arketime/new"
        createLabel="Arketim i ri"
        createPermission={PERMISSIONS.salesInvoicesPay}
      />

      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900">Workflow operativ per unapplied receipts</p>
            <p className="mt-1 text-sm text-slate-500">
              Nese teprica eshte regjistruar ne nje arketim, ketu mund ta rialokosh me vone te faturat e tjera te te njejtit klient.
            </p>
          </div>
          <Link
            href="/arketime"
            className="inline-flex rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Shko te aktiviteti i arketimeve
          </Link>
        </div>
      </div>

      <SettlementReallocationClient
        mode="receipt"
        parties={customers}
        endpointBase="finance-settlements/receipts"
        partyLabel="Klienti"
        documentBasePath="/sales-invoices"
        activityHref="/arketime"
        emptyText="Nuk ka balanca unapplied per klientet e filtruar."
        initialSearch={initialSearch}
        initialPartyId={initialCustomerId}
        initialStatus={initialStatus}
      />
    </div>
  );
}
