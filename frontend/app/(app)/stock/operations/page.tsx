import { PageHeader } from '@/components/page-header';
import { api } from '@/lib/api';
import { StockOperationsClient } from '@/components/stock/stock-operations-client';

export default async function StockOperationsPage() {
  const [warehouses, items] = await Promise.all([
    api.list('warehouses'),
    api.list('items'),
  ]);

  return (
    <div>
      <PageHeader
        title="Operacionet e Stokut"
        description="Adjustments, transfers dhe stock counting me audit trail te plote."
      />
      <StockOperationsClient warehouses={warehouses} items={items} />
    </div>
  );
}
