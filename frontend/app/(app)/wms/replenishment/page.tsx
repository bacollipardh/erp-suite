import { PageHeader } from '@/components/page-header';
import { WmsReplenishmentForm } from '@/components/wms/wms-forms-client';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function WmsReplenishmentPage() {
  await requirePagePermission(PERMISSIONS.wmsMove);
  const [locations, items] = await Promise.all([
    api.list('wms/locations', { limit: 500 }),
    api.list('items', { limit: 500 }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Replenishment WMS"
        description="Rimbush lokacionet picking nga storage per te mbajtur shitjen gati."
      />
      <WmsReplenishmentForm
        locations={locations.filter((location: any) => location.status === 'ACTIVE')}
        items={items.filter((item: any) => item.isActive !== false)}
      />
    </div>
  );
}
