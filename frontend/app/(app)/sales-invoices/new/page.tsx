import { PageHeader } from '@/components/page-header';
import { SalesInvoiceForm } from '@/components/invoices/sales-invoice-form';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function NewSalesInvoicePage() {
  await requirePagePermission(PERMISSIONS.salesInvoicesManage);
  const [series, customers, warehouses, paymentMethods, items] = await Promise.all([
    api.list('document-series'),
    api.list('customers'),
    api.list('warehouses'),
    api.list('payment-methods'),
    api.list('items'),
  ]);

  return (
    <div>
      <PageHeader title="New Sales Invoice" description="Krijo draft faturë shitëse." />
      <SalesInvoiceForm
        mode="create"
        series={series.filter((x: any) => x.documentType === 'SALES_INVOICE')}
        customers={customers}
        warehouses={warehouses}
        paymentMethods={paymentMethods}
        items={items}
      />
    </div>
  );
}
