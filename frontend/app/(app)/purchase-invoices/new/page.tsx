import { PageHeader } from '@/components/page-header';
import { PurchaseInvoiceForm } from '@/components/invoices/purchase-invoice-form';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function NewPurchaseInvoicePage() {
  await requirePagePermission(PERMISSIONS.purchaseInvoicesManage);
  const [series, suppliers, warehouses, items] = await Promise.all([
    api.list('document-series'),
    api.list('suppliers'),
    api.list('warehouses'),
    api.list('items'),
  ]);

  return (
    <div>
      <PageHeader title="New Purchase Invoice" description="Krijo draft faturë blerëse." />
      <PurchaseInvoiceForm
        mode="create"
        series={series.filter((x: any) => x.documentType === 'PURCHASE_INVOICE')}
        suppliers={suppliers}
        warehouses={warehouses}
        items={items}
      />
    </div>
  );
}
