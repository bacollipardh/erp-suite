import { PageHeader } from '@/components/page-header';
import { WmsPackingClient } from '@/components/wms/wms-forms-client';
import { api } from '@/lib/api';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function WmsPackingPage() {
  const user = await requirePagePermission(PERMISSIONS.wmsPick);
  const canReadSalesInvoices = hasPermission(user.permissions, PERMISSIONS.salesInvoicesRead);
  const invoices = canReadSalesInvoices
    ? await api.list('sales-invoices', { limit: 300 })
    : [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Packing Shitje WMS"
        description="Konfirmo paketimin pasi picking eshte kryer; pastaj fatura mund te postohet dhe te krijoje shipping."
      />
      {canReadSalesInvoices ? (
        <WmsPackingClient invoices={invoices.filter((invoice: any) => invoice.status === 'DRAFT')} />
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Per te zgjedhur faturat draft duhet edhe leja per leximin e faturave te shitjes.
        </div>
      )}
    </div>
  );
}
