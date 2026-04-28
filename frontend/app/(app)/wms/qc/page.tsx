import { PageHeader } from '@/components/page-header';
import { WmsStatusForm } from '@/components/wms/wms-forms-client';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function WmsQualityPage() {
  await requirePagePermission(PERMISSIONS.wmsManage);
  const [locations, items] = await Promise.all([
    api.list('wms/locations', { limit: 500 }),
    api.list('items', { limit: 500 }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="QC dhe Bllokim WMS"
        description="Ndrysho statusin e inventarit ne available, quarantine, damaged ose expired."
      />
      <WmsStatusForm
        locations={locations.filter((location: any) => location.status === 'ACTIVE' || location.status === 'QUARANTINE')}
        items={items.filter((item: any) => item.isActive !== false)}
      />
    </div>
  );
}
