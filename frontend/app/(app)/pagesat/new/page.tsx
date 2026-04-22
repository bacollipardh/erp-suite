import { PageHeader } from '@/components/page-header';
import { PaymentEntryClient } from '@/components/finance/payment-entry-client';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function NewSupplierPaymentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePagePermission(PERMISSIONS.purchaseInvoicesPay);
  const query = await searchParams;
  const [report, financeAccounts] = await Promise.all([
    api.query('reports/payables-aging', { limit: 500 }),
    api.list('finance-accounts', {
      isActive: true,
      limit: 100,
      sortBy: 'name',
      sortOrder: 'asc',
    }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pagese e re"
        description="Zgjidh nje fature te hapur dhe regjistro pagesen ndaj furnitorit nga kjo faqe."
      />
      <PaymentEntryClient
        mode="payment"
        documents={report.items ?? []}
        detailBasePath="/purchase-invoices"
        submitBasePath="purchase-invoices"
        listHref="/pagesat"
        financeAccounts={financeAccounts}
        initialDocumentId={typeof query.documentId === 'string' ? query.documentId : undefined}
      />
    </div>
  );
}
