'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { DataTable } from '@/components/data-table';

type PaginatedResponse<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  pageCount: number;
};

export function StockBalancesClient({
  warehouses,
  items,
}: {
  warehouses: any[];
  items: any[];
}) {
  const [warehouseId, setWarehouseId] = useState('');
  const [itemId, setItemId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState<PaginatedResponse<any>>({
    items: [],
    page: 1,
    limit: 20,
    total: 0,
    pageCount: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadBalances() {
      setLoading(true);
      setError(null);

      try {
        const result = await api.listPage('stock/balance', {
          page,
          limit: 20,
          search,
          warehouseId,
          itemId,
          sortBy: 'updatedAt',
          sortOrder: 'desc',
        });

        if (active) setPayload(result);
      } catch (err: any) {
        if (active) setError(err?.message ?? 'Ngarkimi i gjendjes deshtoi.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadBalances();

    return () => {
      active = false;
    };
  }, [itemId, page, search, warehouseId]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="Kerko artikull, kod ose magazine..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={warehouseId}
            onChange={(e) => {
              setWarehouseId(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Te gjitha magazinat</option>
            {warehouses.map((warehouse: any) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
          <select
            value={itemId}
            onChange={(e) => {
              setItemId(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Te gjithe artikujt</option>
            {items.map((item: any) => (
              <option key={item.id} value={item.id}>
                {item.code ? `[${item.code}] ` : ''}
                {item.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setWarehouseId('');
              setItemId('');
              setSearch('');
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Reseto filtrat
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-400">
          Duke ngarkuar gjendjen e stokut...
        </div>
      ) : (
        <DataTable
          data={payload.items}
          columns={[
            { key: 'warehouse', title: 'Magazina', render: (row: any) => row.warehouse?.name ?? '-' },
            { key: 'item', title: 'Artikulli', render: (row: any) => row.item?.name ?? '-' },
            { key: 'qtyOnHand', title: 'Sasia', render: (row: any) => row.qtyOnHand },
            { key: 'avgCost', title: 'Kosto Mesatare', render: (row: any) => row.avgCost },
            {
              key: 'updatedAt',
              title: 'Perditesuar',
              render: (row: any) => new Date(row.updatedAt).toLocaleString('sq-AL'),
            },
          ]}
        />
      )}

      <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
        <span className="text-slate-500">
          Totali: <strong className="text-slate-900">{payload.total}</strong> rreshta
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={payload.page <= 1}
            className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-50"
          >
            Mbrapa
          </button>
          <span className="text-slate-600">
            Faqja {payload.page} / {payload.pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(payload.pageCount, current + 1))}
            disabled={payload.page >= payload.pageCount}
            className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-50"
          >
            Para
          </button>
        </div>
      </div>
    </div>
  );
}
