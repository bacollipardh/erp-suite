import { PageHeader } from '@/components/page-header';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';
import { StockMovementsClient } from '@/components/stock/stock-movements-client';

export default async function StockMovementsPage() {
  await requirePagePermission(PERMISSIONS.stockRead);
  const [warehouses, items] = await Promise.all([
    api.list('warehouses'),
    api.list('items'),
  ]);

  return (
    <div>
      <PageHeader
        title="Levizjet e Stokut"
        description="Historiku i plote i hyrjeve, daljeve dhe operacioneve me filtra operative."
      />
      <StockMovementsClient
        warehouses={warehouses.filter((warehouse: any) => warehouse.isActive !== false)}
        items={items.filter((item: any) => item.isActive !== false)}
      />
    </div>
  );
}
