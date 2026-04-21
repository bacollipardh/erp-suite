import { PageHeader } from '@/components/page-header';
import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { api } from '@/lib/api';

export default async function SalesInvoicesPage() {
  const docs = await api.list('sales-invoices');

  return (
    <div>
      <PageHeader
        title="Faturat e Shitjes"
        description="Faturat e shitjes, zbritjet dhe dalja e stokut."
        createHref="/sales-invoices/new"
        createLabel="Faturë e Re Shitjeje"
      />
      <DataTable
        data={docs}
        detailsBasePath="/sales-invoices"
        columns={[
          { key: 'docNo', title: 'Nr. Doc', render: (row: any) => row.docNo },
          { key: 'customer', title: 'Klienti', render: (row: any) => row.customer?.name ?? '-' },
          { key: 'warehouse', title: 'Magazina', render: (row: any) => row.warehouse?.name ?? '-' },
          { key: 'docDate', title: 'Data', render: (row: any) => String(row.docDate).slice(0, 10) },
          { key: 'grandTotal', title: 'Totali', render: (row: any) => row.grandTotal },
          { key: 'status', title: 'Statusi', render: (row: any) => <StatusBadge value={row.status} /> },
        ]}
      />
    </div>
  );
}
