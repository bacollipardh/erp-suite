import { PageHeader } from '@/components/page-header';
import { StockOperationsClient } from '@/components/stock/stock-operations-client';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function StockCountPage() {
  await requirePagePermission(PERMISSIONS.stockAdjust);
  const [warehouses, items] = await Promise.all([api.list('warehouses'), api.list('items')]);

  return (
    <div>
      <PageHeader
        title="Inventarizim"
        description="Vendos sasine e numeruar dhe lejo sistemin te gjeneroje diferencen ne stok."
      />
      <StockOperationsClient
        mode="count"
        warehouses={warehouses.filter((warehouse: any) => warehouse.isActive !== false)}
        items={items.filter((item: any) => item.isActive !== false)}
      />
    </div>
  );
}
