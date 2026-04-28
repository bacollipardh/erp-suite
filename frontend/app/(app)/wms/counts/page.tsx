import { PageHeader } from '@/components/page-header';
import { WmsCountForm } from '@/components/wms/wms-forms-client';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function WmsCountsPage() {
  await requirePagePermission(PERMISSIONS.wmsCount);
  const [locations, items] = await Promise.all([
    api.list('wms/locations', { limit: 500 }),
    api.list('items', { limit: 500 }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inventarizim WMS"
        description="Vendos sasine e numeruar per lokacionin dhe krijo levizjen e diferences."
      />
      <WmsCountForm
        locations={locations.filter((location: any) => location.status === 'ACTIVE' || location.status === 'QUARANTINE')}
        items={items.filter((item: any) => item.isActive !== false)}
      />
    </div>
  );
}
