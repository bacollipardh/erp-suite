import { PageHeader } from '@/components/page-header';
import { api } from '@/lib/api';
import { StockBalancesClient } from '@/components/stock/stock-balances-client';

export default async function StockBalancesPage() {
  const [warehouses, items] = await Promise.all([
    api.list('warehouses'),
    api.list('items'),
  ]);

  return (
    <div>
      <PageHeader
        title="Gjendja e Stokut"
        description="Gjendja aktuale e stokut sipas magazineve dhe artikujve."
      />
      <StockBalancesClient warehouses={warehouses} items={items} />
    </div>
  );
}
