import { PageHeader } from '@/components/page-header';
import { DataTable } from '@/components/data-table';
import { api } from '@/lib/api';

export default async function StockBalancesPage() {
  const balances = await api.list('stock/balance');

  return (
    <div>
      <PageHeader title="Gjendja e Stokut" description="Gjendja aktuale e stokut sipas magazinës dhe artikullit." />
      <DataTable
        data={balances}
        columns={[
          { key: 'warehouse', title: 'Magazina', render: (row: any) => row.warehouse?.name ?? '-' },
          { key: 'item', title: 'Artikulli', render: (row: any) => row.item?.name ?? '-' },
          { key: 'qtyOnHand', title: 'Sasia', render: (row: any) => row.qtyOnHand },
          { key: 'avgCost', title: 'Kost. Mesatare', render: (row: any) => row.avgCost },
          { key: 'updatedAt', title: 'Përditësuar Më', render: (row: any) => new Date(row.updatedAt).toLocaleString() },
        ]}
      />
    </div>
  );
}
