import { PageHeader } from '@/components/page-header';
import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { api } from '@/lib/api';
import { formatDateOnly } from '@/lib/date';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function SalesInvoicesPage() {
  await requirePagePermission(PERMISSIONS.salesInvoicesRead);
  const docs = await api.list('sales-invoices');

  return (
    <div>
      <PageHeader
        title="Faturat e Shitjes"
        description="Faturat e shitjes, pagesat dhe fiskalizimi."
        createHref="/sales-invoices/new"
        createLabel="Fature e Re Shitjeje"
        createPermission={PERMISSIONS.salesInvoicesManage}
      />
      <DataTable
        data={docs}
        detailsBasePath="/sales-invoices"
        detailsPermission={PERMISSIONS.salesInvoicesManage}
        columns={[
          { key: 'docNo', title: 'Nr. Doc', render: (row: any) => row.docNo },
          { key: 'customer', title: 'Klienti', render: (row: any) => row.customer?.name ?? '-' },
          { key: 'warehouse', title: 'Magazina', render: (row: any) => row.warehouse?.name ?? '-' },
          { key: 'docDate', title: 'Data', render: (row: any) => formatDateOnly(row.docDate) },
          { key: 'dueDate', title: 'Afati', render: (row: any) => formatDateOnly(row.dueDate) },
          { key: 'grandTotal', title: 'Totali', render: (row: any) => row.grandTotal },
          { key: 'outstandingAmount', title: 'Mbetur', render: (row: any) => row.outstandingAmount },
          { key: 'paymentStatus', title: 'Pagesa', render: (row: any) => <StatusBadge value={row.paymentStatus} /> },
          { key: 'dueState', title: 'Afati Pageses', render: (row: any) => <StatusBadge value={row.dueState} /> },
          { key: 'fiscalStatus', title: 'Fiskalizimi', render: (row: any) => <StatusBadge value={row.fiscalStatus} /> },
          { key: 'status', title: 'Statusi', render: (row: any) => <StatusBadge value={row.status} /> },
        ]}
      />
    </div>
  );
}
