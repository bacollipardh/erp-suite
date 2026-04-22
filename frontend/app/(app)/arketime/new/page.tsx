import { PageHeader } from '@/components/page-header';
import { PaymentEntryClient } from '@/components/finance/payment-entry-client';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function NewReceiptPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePagePermission(PERMISSIONS.salesInvoicesPay);
  const query = await searchParams;
  const [report, financeAccounts] = await Promise.all([
    api.query('reports/receivables-aging', { limit: 500 }),
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
        title="Arketim i ri"
        description="Zgjidh nje fature te hapur dhe regjistro arketimin me workflow te dedikuar."
      />
      <PaymentEntryClient
        mode="receipt"
        documents={report.items ?? []}
        detailBasePath="/sales-invoices"
        submitBasePath="sales-invoices"
        listHref="/arketime"
        financeAccounts={financeAccounts}
        initialDocumentId={typeof query.documentId === 'string' ? query.documentId : undefined}
      />
    </div>
  );
}
