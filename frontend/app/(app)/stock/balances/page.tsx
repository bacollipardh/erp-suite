import { PageHeader } from '@/components/page-header';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';
import { StockBalancesClient } from '@/components/stock/stock-balances-client';

export default async function StockBalancesPage() {
  await requirePagePermission(PERMISSIONS.stockRead);
  const [warehouses, items] = await Promise.all([
    api.list('warehouses'),
    api.list('items'),
  ]);

  return (
    <div>
      <PageHeader
        title="Gjendja e Stokut"
        description="Gjendja aktuale, vlera orientuese dhe filtrat operative sipas magazineve dhe artikujve."
      />
      <StockBalancesClient
        warehouses={warehouses.filter((warehouse: any) => warehouse.isActive !== false)}
        items={items.filter((item: any) => item.isActive !== false)}
      />
    </div>
  );
}
