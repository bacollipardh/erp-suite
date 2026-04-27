import { PageHeader } from '@/components/page-header';
import { FinanceDocumentForm } from '@/components/finance-documents/finance-document-form';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function Page() {
  await requirePagePermission(PERMISSIONS.salesInvoicesPay);
  const [customers, financeAccounts, invoices] = await Promise.all([
    api.list('customers', { limit: 200, sortBy: 'name', sortOrder: 'asc' }),
    api.list('finance-accounts', { isActive: true, limit: 100, sortBy: 'name', sortOrder: 'asc' }),
    api.list('sales-invoices', { limit: 100, sortBy: 'createdAt', sortOrder: 'desc' }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Krijo Customer Receipt"
        description="Regjistro customer receipt dhe aloko pagesen direkt ne faturat e hapura te klientit."
      />
      <FinanceDocumentForm
        type="customer-receipt"
        endpoint="customer-receipts"
        backHref="/financa/dokumente-arketimi"
        parties={customers}
        financeAccounts={financeAccounts}
        invoices={invoices}
      />
    </div>
  );
}
