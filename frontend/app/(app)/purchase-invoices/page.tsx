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

export default async function PurchaseInvoicesPage() {
  const user = await requirePagePermission(PERMISSIONS.purchaseInvoicesRead);
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
      <ServerDataTable
        data={docs}
        detailsBasePath="/purchase-invoices"
        canOpenDetails={hasPermission(user.permissions, PERMISSIONS.purchaseInvoicesManage)}
        columns={[
          { key: 'docNo', title: 'Nr. Doc', render: (row: any) => row.docNo },
          { key: 'supplier', title: 'Furnitori', render: (row: any) => row.supplier?.name ?? '-' },
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
          { key: 'status', title: 'Statusi', render: (row: any) => <StatusBadge value={row.status} /> },
        ]}
      />
    </div>
  );
}
