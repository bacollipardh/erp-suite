import { PageHeader } from '@/components/page-header';
import { WmsScannerClient } from '@/components/wms/wms-forms-client';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function WmsScannerPage() {
  await requirePagePermission(PERMISSIONS.wmsRead);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Scanner WMS"
        description="Kerko shpejt me barcode, kod artikulli, kod lokacioni, lot kod ose serial number."
      />
      <WmsScannerClient />
    </div>
  );
}
