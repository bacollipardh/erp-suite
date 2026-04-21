import { StatsCard } from '@/components/stats-card';
import { api } from '@/lib/api';

export default async function DashboardPage() {
  const [items, suppliers, customers, purchaseInvoices, salesInvoices, salesReturns, stockBalances] =
    await Promise.all([
      api.list('items'),
      api.list('suppliers'),
      api.list('customers'),
      api.list('purchase-invoices'),
      api.list('sales-invoices'),
      api.list('sales-returns'),
      api.list('stock/balance'),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Ballina</h1>
        <p className="text-sm text-slate-500 mt-1">Pamje e përgjithshme e sistemit.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard title="Artikujt" value={items.length} />
        <StatsCard title="Furnitorët" value={suppliers.length} />
        <StatsCard title="Klientët" value={customers.length} />
        <StatsCard title="Linjat e Stokut" value={stockBalances.length} />
        <StatsCard title="Faturat e Blerjes" value={purchaseInvoices.length} />
        <StatsCard title="Faturat e Shitjes" value={salesInvoices.length} />
        <StatsCard title="Kthimet e Shitjes" value={salesReturns.length} />
      </div>
    </div>
  );
}
