import { PageHeader } from '@/components/page-header';
import { SalesReturnForm } from '@/components/invoices/sales-return-form';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function NewSalesReturnPage() {
  await requirePagePermission(PERMISSIONS.salesReturnsManage);
  const [series, customers, salesInvoices, items] = await Promise.all([
    api.list('document-series'),
    api.list('customers'),
    api.list('sales-invoices'),
    api.list('items'),
  ]);

  return (
    <div>
      <PageHeader title="New Sales Return" description="Krijo draft kthim shitjeje." />
      <SalesReturnForm
        mode="create"
        series={series.filter((x: any) => x.documentType === 'SALES_RETURN')}
        customers={customers}
        salesInvoices={salesInvoices}
        items={items}
      />
    </div>
  );
}
