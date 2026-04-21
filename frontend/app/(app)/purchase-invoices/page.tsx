import { PageHeader } from '@/components/page-header';
import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { api } from '@/lib/api';
import { formatDateOnly } from '@/lib/date';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function PurchaseInvoicesPage() {
  await requirePagePermission(PERMISSIONS.purchaseInvoicesRead);
  const docs = await api.list('purchase-invoices');

  return (
    <div>
      <PageHeader
        title="Faturat e Blerjes"
        description="Faturat e blerjes, pagesat dhe hyrjet e stokut."
        createHref="/purchase-invoices/new"
        createLabel="Fature e Re Blerjeje"
        createPermission={PERMISSIONS.purchaseInvoicesManage}
      />
      <DataTable
        data={docs}
        detailsBasePath="/purchase-invoices"
        detailsPermission={PERMISSIONS.purchaseInvoicesManage}
        columns={[
          { key: 'docNo', title: 'Nr. Doc', render: (row: any) => row.docNo },
          { key: 'supplier', title: 'Furnitori', render: (row: any) => row.supplier?.name ?? '-' },
          { key: 'warehouse', title: 'Magazina', render: (row: any) => row.warehouse?.name ?? '-' },
          { key: 'docDate', title: 'Data', render: (row: any) => formatDateOnly(row.docDate) },
          { key: 'dueDate', title: 'Afati', render: (row: any) => formatDateOnly(row.dueDate) },
          { key: 'grandTotal', title: 'Totali', render: (row: any) => row.grandTotal },
          { key: 'outstandingAmount', title: 'Mbetur', render: (row: any) => row.outstandingAmount },
          { key: 'paymentStatus', title: 'Pagesa', render: (row: any) => <StatusBadge value={row.paymentStatus} /> },
          { key: 'dueState', title: 'Afati Pageses', render: (row: any) => <StatusBadge value={row.dueState} /> },
          { key: 'status', title: 'Statusi', render: (row: any) => <StatusBadge value={row.status} /> },
        ]}
      />
    </div>
  );
}
