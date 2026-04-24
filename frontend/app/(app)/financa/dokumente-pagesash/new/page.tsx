import { PageHeader } from '@/components/page-header';
import { FinanceDocumentForm } from '@/components/finance-documents/finance-document-form';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function Page() {
  await requirePagePermission(PERMISSIONS.purchaseInvoicesPay);
  const [suppliers, financeAccounts, invoices] = await Promise.all([
    api.list('suppliers', { limit: 200, sortBy: 'name', sortOrder: 'asc' }),
    api.list('finance-accounts', { isActive: true, limit: 100, sortBy: 'name', sortOrder: 'asc' }),
    api.list('purchase-invoices', { limit: 100, sortBy: 'createdAt', sortOrder: 'desc' }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Krijo Supplier Payment"
        description="Regjistro supplier payment dhe aloko pagesen direkt ne faturat e hapura te furnitorit."
      />
      <FinanceDocumentForm
        type="supplier-payment"
        endpoint="supplier-payments"
        backHref="/financa/dokumente-pagesash"
        parties={suppliers}
        financeAccounts={financeAccounts}
        invoices={invoices}
      />
    </div>
  );
}
