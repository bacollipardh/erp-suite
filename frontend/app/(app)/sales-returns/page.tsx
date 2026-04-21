import { PageHeader } from '@/components/page-header';
import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { api } from '@/lib/api';

export default async function SalesReturnsPage() {
  const docs = await api.list('sales-returns');

  return (
    <div>
      <PageHeader
        title="Kthimet e Shitjes"
        description="Kthimet e artikujve të lidhura me faturat shitëse."
        createHref="/sales-returns/new"
        createLabel="Kthim i Ri Shitjeje"
      />
      <DataTable
        data={docs}
        detailsBasePath="/sales-returns"
        columns={[
          { key: 'docNo', title: 'Nr. Doc', render: (row: any) => row.docNo },
          { key: 'customer', title: 'Klienti', render: (row: any) => row.customer?.name ?? '-' },
          { key: 'salesInvoice', title: 'Fatura e Shitjes', render: (row: any) => row.salesInvoice?.docNo ?? '-' },
          { key: 'docDate', title: 'Data', render: (row: any) => String(row.docDate).slice(0, 10) },
          { key: 'grandTotal', title: 'Totali', render: (row: any) => row.grandTotal },
          { key: 'status', title: 'Statusi', render: (row: any) => <StatusBadge value={row.status} /> },
        ]}
      />
    </div>
  );
}
