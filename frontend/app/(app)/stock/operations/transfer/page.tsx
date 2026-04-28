import { PageHeader } from '@/components/page-header';
import { StockOperationsClient } from '@/components/stock/stock-operations-client';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function StockTransferPage() {
  await requirePagePermission(PERMISSIONS.stockTransfer);
  const [warehouses, items] = await Promise.all([api.list('warehouses'), api.list('items')]);

  return (
    <div>
      <PageHeader
        title="Transfer Magazinash"
        description="Leviz sasi nga magazina burim ne magazinen destinacion me reference te vetme operative."
      />
      <StockOperationsClient
        mode="transfer"
        warehouses={warehouses.filter((warehouse: any) => warehouse.isActive !== false)}
        items={items.filter((item: any) => item.isActive !== false)}
      />
    </div>
  );
}
