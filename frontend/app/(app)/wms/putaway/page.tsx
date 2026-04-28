import { PageHeader } from '@/components/page-header';
import { WmsPutawayForm } from '@/components/wms/wms-forms-client';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function WmsPutawayPage() {
  await requirePagePermission(PERMISSIONS.wmsMove);
  const [locations, items] = await Promise.all([
    api.list('wms/locations', { limit: 500 }),
    api.list('items', { limit: 500 }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Putaway WMS"
        description="Leviz mallin nga receiving, returns ose quarantine drejt storage/picking."
      />
      <WmsPutawayForm
        locations={locations.filter((location: any) => location.status === 'ACTIVE' || location.status === 'QUARANTINE')}
        items={items.filter((item: any) => item.isActive !== false)}
      />
    </div>
  );
}
