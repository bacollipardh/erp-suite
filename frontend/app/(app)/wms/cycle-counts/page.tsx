import { PageHeader } from '@/components/page-header';
import { WmsCycleCountPlanForm } from '@/components/wms/wms-forms-client';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function WmsCycleCountsPage() {
  await requirePagePermission(PERMISSIONS.wmsCount);
  const [warehouses, locations, items] = await Promise.all([
    api.list('warehouses', { limit: 500 }),
    api.list('wms/locations', { limit: 500 }),
    api.list('items', { limit: 500 }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Plan Cycle Count"
        description="Krijo detyra numerimi sipas magazines, lokacionit ose artikullit."
      />
      <WmsCycleCountPlanForm
        warehouses={warehouses.filter((warehouse: any) => warehouse.isActive !== false)}
        locations={locations.filter((location: any) => location.status === 'ACTIVE' || location.status === 'QUARANTINE')}
        items={items.filter((item: any) => item.isActive !== false)}
      />
    </div>
  );
}
