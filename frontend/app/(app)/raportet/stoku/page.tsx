import { PageHeader } from '@/components/page-header';
import { StockReportClient } from '@/components/reports/stock-report-client';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function StockReportsPage() {
  await requirePagePermission(PERMISSIONS.stockRead);

  const [warehouses, items] = await Promise.all([
    api.list('warehouses'),
    api.list('items'),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Raportet e Stokut"
        description="Snapshot i stokut dhe levizjet materiale te ndara si domain i trete i raportimit, me filtra reale sipas magazines, kategorise, artikullit dhe periudhes."
      />

      <StockReportClient
        warehouses={warehouses.filter((warehouse: any) => warehouse.isActive !== false)}
        items={items.filter((item: any) => item.isActive !== false)}
      />
    </div>
  );
}
