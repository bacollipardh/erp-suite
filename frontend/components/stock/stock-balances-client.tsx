'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { DataTable } from '@/components/data-table';

type PaginatedResponse<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  pageCount: number;
};

function formatQty(value: number | string | null | undefined) {
  return Number(value ?? 0).toLocaleString('sq-AL', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function formatMoney(value: number | string | null | undefined) {
  return Number(value ?? 0).toLocaleString('sq-AL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

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

  const pageSummary = useMemo(() => {
    const totalQty = payload.items.reduce((sum, row) => sum + Number(row.qtyOnHand ?? 0), 0);
    const stockValue = payload.items.reduce(
      (sum, row) => sum + Number(row.qtyOnHand ?? 0) * Number(row.avgCost ?? 0),
      0,
    );
    const warehouseCount = new Set(payload.items.map((row) => row.warehouse?.id).filter(Boolean)).size;

    return {
      totalQty,
      stockValue,
      warehouseCount,
      visibleRows: payload.items.length,
    };
  }, [payload.items]);

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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Rreshta ne pamje</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{pageSummary.visibleRows}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Sasia totale</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{formatQty(pageSummary.totalQty)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Vlera orientuese</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{formatMoney(pageSummary.stockValue)} EUR</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Magazina ne pamje</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{pageSummary.warehouseCount}</p>
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
            {
              key: 'warehouse',
              title: 'Magazina',
              render: (row: any) => (
                <div className="min-w-[180px]">
                  <p className="font-medium text-slate-800">{row.warehouse?.name ?? '-'}</p>
                  <p className="text-xs text-slate-400">{row.warehouse?.code ?? '-'}</p>
                </div>
              ),
            },
            {
              key: 'item',
              title: 'Artikulli',
              render: (row: any) => (
                <div className="min-w-[220px]">
                  <p className="font-medium text-slate-800">{row.item?.name ?? '-'}</p>
                  <p className="text-xs text-slate-400">{row.item?.code ?? '-'}</p>
                </div>
              ),
            },
            { key: 'qtyOnHand', title: 'Sasia', render: (row: any) => formatQty(row.qtyOnHand) },
            { key: 'avgCost', title: 'Kosto Mesatare', render: (row: any) => `${formatMoney(row.avgCost)} EUR` },
            {
              key: 'stockValue',
              title: 'Vlera',
              render: (row: any) => `${formatMoney(Number(row.qtyOnHand ?? 0) * Number(row.avgCost ?? 0))} EUR`,
            },
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
