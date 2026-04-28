import { PageHeader } from '@/components/page-header';
import { WmsMoveForm } from '@/components/wms/wms-forms-client';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function WmsMovePage() {
  await requirePagePermission(PERMISSIONS.wmsMove);
  const [locations, items] = await Promise.all([
    api.list('wms/locations', { limit: 500 }),
    api.list('items', { limit: 500 }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Levizje Bin-to-Bin"
        description="Leviz stokun brenda te njejtes magazine nga lokacioni burim te lokacioni destinacion."
      />
      <WmsMoveForm
        locations={locations.filter((location: any) => location.status === 'ACTIVE' || location.status === 'QUARANTINE')}
        items={items.filter((item: any) => item.isActive !== false)}
      />
    </div>
  );
}
