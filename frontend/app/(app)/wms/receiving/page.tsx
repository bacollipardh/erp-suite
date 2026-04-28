import { PageHeader } from '@/components/page-header';
import { WmsReceiveForm } from '@/components/wms/wms-forms-client';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function WmsReceivingPage() {
  await requirePagePermission(PERMISSIONS.wmsReceive);
  const [locations, items] = await Promise.all([
    api.list('wms/locations', { limit: 500 }),
    api.list('items', { limit: 500 }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pranim Malli WMS"
        description="Regjistro hyrjen ne lokacion me gjurme per lot, skadence, serial number dhe reference."
      />
      <WmsReceiveForm
        locations={locations.filter((location: any) => location.status === 'ACTIVE' || location.status === 'QUARANTINE')}
        items={items.filter((item: any) => item.isActive !== false)}
      />
    </div>
  );
}
