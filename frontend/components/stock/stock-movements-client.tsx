'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';

type PaginatedResponse<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  pageCount: number;
};

const MOVEMENT_TYPES = [
  'PURCHASE_IN',
  'SALE_OUT',
  'SALES_RETURN_IN',
  'ADJUSTMENT_PLUS',
  'ADJUSTMENT_MINUS',
  'TRANSFER_OUT',
  'TRANSFER_IN',
  'COUNT_IN',
  'COUNT_OUT',
];

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

export function StockMovementsClient({
  warehouses,
  items,
}: {
  warehouses: any[];
  items: any[];
}) {
  const [warehouseId, setWarehouseId] = useState('');
  const [itemId, setItemId] = useState('');
  const [movementType, setMovementType] = useState('');
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

    async function loadMovements() {
      setLoading(true);
      setError(null);

      try {
        const result = await api.listPage('stock/movements', {
          page,
          limit: 20,
          search,
          warehouseId,
          itemId,
          movementType,
          sortBy: 'movementAt',
          sortOrder: 'desc',
        });

        if (active) setPayload(result);
      } catch (err: any) {
        if (active) setError(err?.message ?? 'Ngarkimi i levizjeve deshtoi.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadMovements();

    return () => {
      active = false;
    };
  }, [itemId, movementType, page, search, warehouseId]);

  const pageSummary = useMemo(() => {
    const totalIn = payload.items.reduce((sum, row) => sum + Number(row.qtyIn ?? 0), 0);
    const totalOut = payload.items.reduce((sum, row) => sum + Number(row.qtyOut ?? 0), 0);
    const references = new Set(payload.items.map((row) => row.referenceNo).filter(Boolean)).size;

    return {
      totalIn,
      totalOut,
      references,
      visibleRows: payload.items.length,
    };
  }, [payload.items]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input
            type="text"
            placeholder="Kerko reference, artikull ose magazine..."
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
          <select
            value={movementType}
            onChange={(e) => {
              setMovementType(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Te gjitha levizjet</option>
            {MOVEMENT_TYPES.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setWarehouseId('');
              setItemId('');
              setMovementType('');
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
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Hyrje totale</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{formatQty(pageSummary.totalIn)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Dalje totale</p>
          <p className="mt-1 text-2xl font-bold text-rose-700">{formatQty(pageSummary.totalOut)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Referenca ne pamje</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{pageSummary.references}</p>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-400">
          Duke ngarkuar levizjet e stokut...
        </div>
      ) : (
        <DataTable
          data={payload.items}
          columns={[
            {
              key: 'warehouse',
              title: 'Magazina',
              render: (row: any) => (
                <div className="min-w-[170px]">
                  <p className="font-medium text-slate-800">{row.warehouse?.name ?? '-'}</p>
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
            { key: 'movementType', title: 'Tipi', render: (row: any) => <StatusBadge value={row.movementType} /> },
            { key: 'qtyIn', title: 'Hyrje', render: (row: any) => <span className="text-emerald-700">{formatQty(row.qtyIn)}</span> },
            { key: 'qtyOut', title: 'Dalje', render: (row: any) => <span className="text-rose-700">{formatQty(row.qtyOut)}</span> },
            { key: 'unitCost', title: 'Kosto', render: (row: any) => `${formatMoney(row.unitCost)} EUR` },
            { key: 'referenceNo', title: 'Referenca', render: (row: any) => row.referenceNo ?? '-' },
            {
              key: 'movementAt',
              title: 'Levizur',
              render: (row: any) => new Date(row.movementAt).toLocaleString('sq-AL'),
            },
          ]}
        />
      )}

      <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
        <span className="text-slate-500">
          Totali: <strong className="text-slate-900">{payload.total}</strong> levizje
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
