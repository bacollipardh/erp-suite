import { PageHeader } from '@/components/page-header';
import { DueStateReminder } from '@/components/finance/due-state-reminder';
import { ServerDataTable } from '@/components/server-data-table';
import { StatusBadge } from '@/components/status-badge';
import { api } from '@/lib/api';
import { formatDateOnly } from '@/lib/date';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

function formatMoney(value?: number | string | null) {
  return `${Number(value ?? 0).toLocaleString('sq-AL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} EUR`;
}

export default async function SalesInvoicesPage() {
  const user = await requirePagePermission(PERMISSIONS.salesInvoicesRead);
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
      <ServerDataTable
        data={docs}
        detailsBasePath="/sales-invoices"
        canOpenDetails={hasPermission(user.permissions, PERMISSIONS.salesInvoicesManage)}
        columns={[
          { key: 'docNo', title: 'Nr. Doc', render: (row: any) => row.docNo },
          { key: 'customer', title: 'Klienti', render: (row: any) => row.customer?.name ?? '-' },
          { key: 'warehouse', title: 'Magazina', render: (row: any) => row.warehouse?.name ?? '-' },
          { key: 'docDate', title: 'Data', render: (row: any) => formatDateOnly(row.docDate) },
          { key: 'dueDate', title: 'Afati', render: (row: any) => formatDateOnly(row.dueDate) },
          { key: 'grandTotal', title: 'Totali', render: (row: any) => formatMoney(row.grandTotal) },
          { key: 'outstandingAmount', title: 'Mbetur', render: (row: any) => formatMoney(row.outstandingAmount) },
          { key: 'paymentStatus', title: 'Pagesa', render: (row: any) => <StatusBadge value={row.paymentStatus} /> },
          {
            key: 'dueState',
            title: 'Afati Pageses',
            render: (row: any) => (
              <DueStateReminder
                compact
                dueState={row.dueState}
                dueDate={row.dueDate}
                daysPastDue={row.daysPastDue}
                outstandingAmount={row.outstandingAmount}
              />
            ),
          },
          { key: 'fiscalStatus', title: 'Fiskalizimi', render: (row: any) => <StatusBadge value={row.fiscalStatus} /> },
          { key: 'status', title: 'Statusi', render: (row: any) => <StatusBadge value={row.status} /> },
        ]}
      />
    </div>
  );
}
