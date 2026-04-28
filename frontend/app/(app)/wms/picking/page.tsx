import { PageHeader } from '@/components/page-header';
import { WmsPickingClient } from '@/components/wms/wms-forms-client';
import { api } from '@/lib/api';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function WmsPickingPage() {
  const user = await requirePagePermission(PERMISSIONS.wmsPick);
  const canReadSalesInvoices = hasPermission(user.permissions, PERMISSIONS.salesInvoicesRead);
  const invoices = canReadSalesInvoices
    ? await api.list('sales-invoices', { limit: 300 })
    : [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Picking Shitje WMS"
        description="Planifiko rezervimet, konfirmo picking dhe blloko postimin e fatures derisa picking te perfundoje."
      />
      {canReadSalesInvoices ? (
        <WmsPickingClient invoices={invoices.filter((invoice: any) => invoice.status === 'DRAFT')} />
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Per te zgjedhur faturat draft duhet edhe leja per leximin e faturave te shitjes.
        </div>
      )}
    </div>
  );
}
