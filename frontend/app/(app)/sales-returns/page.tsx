import { PageHeader } from '@/components/page-header';
import { ServerDataTable } from '@/components/server-data-table';
import { StatusBadge } from '@/components/status-badge';
import { api } from '@/lib/api';
import { formatDateOnly } from '@/lib/date';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function SalesReturnsPage() {
  const user = await requirePagePermission(PERMISSIONS.salesReturnsRead);
  const docs = await api.list('sales-returns');

  return (
    <div>
      <PageHeader
        title="Kthimet e Shitjes"
        description="Kthimet e artikujve, statuset dhe fiskalizimi i tyre."
        createHref="/sales-returns/new"
        createLabel="Kthim i Ri Shitjeje"
        createPermission={PERMISSIONS.salesReturnsManage}
      />
      <ServerDataTable
        data={docs}
        detailsBasePath="/sales-returns"
        canOpenDetails={hasPermission(user.permissions, PERMISSIONS.salesReturnsManage)}
        columns={[
          { key: 'docNo', title: 'Nr. Doc', render: (row: any) => row.docNo },
          { key: 'customer', title: 'Klienti', render: (row: any) => row.customer?.name ?? '-' },
          { key: 'salesInvoice', title: 'Fatura e Shitjes', render: (row: any) => row.salesInvoice?.docNo ?? '-' },
          { key: 'docDate', title: 'Data', render: (row: any) => formatDateOnly(row.docDate) },
          { key: 'grandTotal', title: 'Totali', render: (row: any) => row.grandTotal },
          { key: 'fiscalStatus', title: 'Fiskalizimi', render: (row: any) => <StatusBadge value={row.fiscalStatus} /> },
          { key: 'status', title: 'Statusi', render: (row: any) => <StatusBadge value={row.status} /> },
        ]}
      />
    </div>
  );
}
