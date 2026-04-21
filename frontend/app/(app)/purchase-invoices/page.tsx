import { PageHeader } from '@/components/page-header';
import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { api } from '@/lib/api';

export default async function PurchaseInvoicesPage() {
  const docs = await api.list('purchase-invoices');

  return (
    <div>
      <PageHeader
        title="Faturat e Blerjes"
        description="Faturat e blerjes, pagesat dhe hyrjet e stokut."
        createHref="/purchase-invoices/new"
        createLabel="Fature e Re Blerjeje"
      />
      <DataTable
        data={docs}
        detailsBasePath="/purchase-invoices"
        columns={[
          { key: 'docNo', title: 'Nr. Doc', render: (row: any) => row.docNo },
          { key: 'supplier', title: 'Furnitori', render: (row: any) => row.supplier?.name ?? '-' },
          { key: 'warehouse', title: 'Magazina', render: (row: any) => row.warehouse?.name ?? '-' },
          { key: 'docDate', title: 'Data', render: (row: any) => String(row.docDate).slice(0, 10) },
          { key: 'grandTotal', title: 'Totali', render: (row: any) => row.grandTotal },
          { key: 'paymentStatus', title: 'Pagesa', render: (row: any) => <StatusBadge value={row.paymentStatus} /> },
          { key: 'status', title: 'Statusi', render: (row: any) => <StatusBadge value={row.status} /> },
        ]}
      />
    </div>
  );
}
