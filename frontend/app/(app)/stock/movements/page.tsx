import { PageHeader } from '@/components/page-header';
import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { api } from '@/lib/api';

export default async function StockMovementsPage() {
  const movements = await api.list('stock/movements');

  return (
    <div>
      <PageHeader title="Lëvizjet e Stokut" description="Historiku i plotë i lëvizjeve të stokut." />
      <DataTable
        data={movements}
        columns={[
          { key: 'warehouse', title: 'Magazina', render: (row: any) => row.warehouse?.name ?? '-' },
          { key: 'item', title: 'Artikulli', render: (row: any) => row.item?.name ?? '-' },
          { key: 'movementType', title: 'Tipi', render: (row: any) => <StatusBadge value={row.movementType} /> },
          { key: 'qtyIn', title: 'Sasia Hyrëse', render: (row: any) => row.qtyIn },
          { key: 'qtyOut', title: 'Sasia Dalëse', render: (row: any) => row.qtyOut },
          { key: 'referenceNo', title: 'Referenca', render: (row: any) => row.referenceNo ?? '-' },
          { key: 'movementAt', title: 'Lëvizur Më', render: (row: any) => new Date(row.movementAt).toLocaleString() },
        ]}
      />
    </div>
  );
}
