'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { api } from '@/lib/api';

type WarehouseOption = {
  id: string;
  code?: string | null;
  name: string;
};

type ItemOption = {
  id: string;
  code?: string | null;
  name: string;
  category?: {
    id: string;
    name: string;
  } | null;
  unit?: {
    id: string;
    code?: string | null;
    name: string;
  } | null;
};

type StockBalanceResponse = {
  items: Array<{
    id: string;
    qtyOnHand: number | string;
    avgCost: number | string;
    updatedAt: string;
    warehouse?: { id: string; code?: string | null; name: string } | null;
    item?: {
      id: string;
      code?: string | null;
      name: string;
      category?: { id: string; name: string } | null;
      unit?: { id: string; code?: string | null; name: string } | null;
    } | null;
  }>;
  page: number;
  limit: number;
  total: number;
  pageCount: number;
  summary: {
    rowCount: number;
    totalQty: number;
    totalValue: number;
    warehouseCount: number;
    itemCount: number;
    categoryCount: number;
    topCategories: Array<{
      category?: { id: string; name: string } | null;
      totalQty: number;
      totalValue: number;
      itemCount: number;
    }>;
  };
};

type StockMovementResponse = {
  items: Array<{
    id: string;
    movementType: string;
    qtyIn: number | string;
    qtyOut: number | string;
    unitCost?: number | string | null;
    referenceNo?: string | null;
    movementAt: string;
    warehouse?: { id: string; code?: string | null; name: string } | null;
    item?: {
      id: string;
      code?: string | null;
      name: string;
      category?: { id: string; name: string } | null;
      unit?: { id: string; code?: string | null; name: string } | null;
    } | null;
    purchaseInvoice?: { id: string; docNo: string } | null;
    salesInvoice?: { id: string; docNo: string } | null;
    salesReturn?: { id: string; docNo: string } | null;
  }>;
  page: number;
  limit: number;
  total: number;
  pageCount: number;
  summary: {
    movementCount: number;
    totalIn: number;
    totalOut: number;
    netQty: number;
    referenceCount: number;
    warehouseCount: number;
    itemCount: number;
    categoryCount: number;
    latestMovementAt?: string | null;
    byType: Array<{
      movementType: string;
      count: number;
      totalIn: number;
      totalOut: number;
      netQty: number;
    }>;
  };
};

type StockReportFilters = {
  search: string;
  warehouseId: string;
  categoryId: string;
  itemId: string;
  movementType: string;
  dateFrom: string;
  dateTo: string;
  balanceSortBy: string;
  balanceSortOrder: 'asc' | 'desc';
  movementSortBy: string;
  movementSortOrder: 'asc' | 'desc';
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

function createDefaultFilters(): StockReportFilters {
  return {
    search: '',
    warehouseId: '',
    categoryId: '',
    itemId: '',
    movementType: '',
    dateFrom: '',
    dateTo: '',
    balanceSortBy: 'updatedAt',
    balanceSortOrder: 'desc',
    movementSortBy: 'movementAt',
    movementSortOrder: 'desc',
  };
}

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

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('sq-AL');
}

function parseApiError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Raporti i stokut deshtoi.';
}

function SummaryCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-400">{sub}</p> : null}
    </div>
  );
}

function BreakdownPanel({
  title,
  description,
  emptyText,
  children,
}: {
  title: string;
  description: string;
  emptyText: string;
  children: ReactNode;
}) {
  const hasContent = Boolean(children);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {hasContent ? children : <p className="text-sm text-slate-400">{emptyText}</p>}
    </div>
  );
}

function PaginationFooter({
  page,
  pageCount,
  total,
  itemLabel,
  onPrev,
  onNext,
}: {
  page: number;
  pageCount: number;
  total: number;
  itemLabel: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
      <span className="text-slate-500">
        Totali: <strong className="text-slate-900">{total}</strong> {itemLabel}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={page <= 1}
          className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-50"
        >
          Mbrapa
        </button>
        <span className="text-slate-600">
          Faqja {page} / {pageCount}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={page >= pageCount}
          className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-50"
        >
          Para
        </button>
      </div>
    </div>
  );
}

function resolveMovementSource(row: StockMovementResponse['items'][number]) {
  if (row.purchaseInvoice?.id && row.purchaseInvoice?.docNo) {
    return {
      href: `/purchase-invoices/${row.purchaseInvoice.id}`,
      label: row.purchaseInvoice.docNo,
    };
  }

  if (row.salesInvoice?.id && row.salesInvoice?.docNo) {
    return {
      href: `/sales-invoices/${row.salesInvoice.id}`,
      label: row.salesInvoice.docNo,
    };
  }

  if (row.salesReturn?.id && row.salesReturn?.docNo) {
    return {
      href: `/sales-returns/${row.salesReturn.id}`,
      label: row.salesReturn.docNo,
    };
  }

  if (row.referenceNo) {
    return {
      href: null,
      label: row.referenceNo,
    };
  }

  return {
    href: null,
    label: '-',
  };
}

export function StockReportClient({
  warehouses,
  items,
}: {
  warehouses: WarehouseOption[];
  items: ItemOption[];
}) {
  const [filters, setFilters] = useState<StockReportFilters>(createDefaultFilters);
  const [balancePage, setBalancePage] = useState(1);
  const [movementPage, setMovementPage] = useState(1);
  const [balances, setBalances] = useState<StockBalanceResponse | null>(null);
  const [movements, setMovements] = useState<StockMovementResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const categories = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();

    for (const item of items) {
      if (item.category?.id && !map.has(item.category.id)) {
        map.set(item.category.id, {
          id: item.category.id,
          name: item.category.name,
        });
      }
    }

    return Array.from(map.values()).sort((left, right) => left.name.localeCompare(right.name, 'sq'));
  }, [items]);

  const itemOptions = useMemo(() => {
    const filteredItems = filters.categoryId
      ? items.filter((item) => item.category?.id === filters.categoryId)
      : items;

    return filteredItems.sort((left, right) => left.name.localeCompare(right.name, 'sq'));
  }, [filters.categoryId, items]);

  useEffect(() => {
    if (!filters.itemId) return;

    const stillVisible = itemOptions.some((item) => item.id === filters.itemId);
    if (!stillVisible) {
      setFilters((current) => ({
        ...current,
        itemId: '',
      }));
      setBalancePage(1);
      setMovementPage(1);
    }
  }, [filters.itemId, itemOptions]);

  useEffect(() => {
    let active = true;

    async function loadReports() {
      setLoading(true);
      setError(null);

      try {
        const [balancePayload, movementPayload] = await Promise.all([
          api.query('stock/balance', {
            page: balancePage,
            limit: 12,
            search: filters.search || undefined,
            warehouseId: filters.warehouseId || undefined,
            categoryId: filters.categoryId || undefined,
            itemId: filters.itemId || undefined,
            sortBy: filters.balanceSortBy,
            sortOrder: filters.balanceSortOrder,
          }),
          api.query('stock/movements', {
            page: movementPage,
            limit: 12,
            search: filters.search || undefined,
            warehouseId: filters.warehouseId || undefined,
            categoryId: filters.categoryId || undefined,
            itemId: filters.itemId || undefined,
            movementType: filters.movementType || undefined,
            dateFrom: filters.dateFrom || undefined,
            dateTo: filters.dateTo || undefined,
            sortBy: filters.movementSortBy,
            sortOrder: filters.movementSortOrder,
          }),
        ]);

        if (!active) return;

        setBalances(balancePayload as StockBalanceResponse);
        setMovements(movementPayload as StockMovementResponse);
      } catch (loadError) {
        if (active) {
          setError(parseApiError(loadError));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadReports();

    return () => {
      active = false;
    };
  }, [balancePage, filters, movementPage]);

  const balanceSummary = balances?.summary ?? {
    rowCount: 0,
    totalQty: 0,
    totalValue: 0,
    warehouseCount: 0,
    itemCount: 0,
    categoryCount: 0,
    topCategories: [],
  };
  const movementSummary = movements?.summary ?? {
    movementCount: 0,
    totalIn: 0,
    totalOut: 0,
    netQty: 0,
    referenceCount: 0,
    warehouseCount: 0,
    itemCount: 0,
    categoryCount: 0,
    latestMovementAt: null,
    byType: [],
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Filtrat e raportit te stokut</h2>
            <p className="mt-1 text-sm text-slate-500">
              Puno me te njejtin scope per snapshot-in e stokut dhe levizjet materiale, pastaj
              zbrit te faqet operative kur te duhet veprim.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/stock/balances"
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Hap gjendjen operative
            </Link>
            <Link
              href="/stock/movements"
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Hap levizjet operative
            </Link>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <input
            type="text"
            value={filters.search}
            onChange={(e) => {
              setFilters((current) => ({ ...current, search: e.target.value }));
              setBalancePage(1);
              setMovementPage(1);
            }}
            placeholder="Kerko artikull, kategori, magazine ose reference..."
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={filters.warehouseId}
            onChange={(e) => {
              setFilters((current) => ({ ...current, warehouseId: e.target.value }));
              setBalancePage(1);
              setMovementPage(1);
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Te gjitha magazinat</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
          <select
            value={filters.categoryId}
            onChange={(e) => {
              setFilters((current) => ({
                ...current,
                categoryId: e.target.value,
                itemId: '',
              }));
              setBalancePage(1);
              setMovementPage(1);
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Te gjitha kategorite</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            value={filters.itemId}
            onChange={(e) => {
              setFilters((current) => ({ ...current, itemId: e.target.value }));
              setBalancePage(1);
              setMovementPage(1);
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Te gjithe artikujt</option>
            {itemOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code ? `[${item.code}] ` : ''}
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <select
            value={filters.movementType}
            onChange={(e) => {
              setFilters((current) => ({ ...current, movementType: e.target.value }));
              setMovementPage(1);
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Te gjitha levizjet</option>
            {MOVEMENT_TYPES.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => {
              setFilters((current) => ({ ...current, dateFrom: e.target.value }));
              setMovementPage(1);
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => {
              setFilters((current) => ({ ...current, dateTo: e.target.value }));
              setMovementPage(1);
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              setFilters(createDefaultFilters());
              setBalancePage(1);
              setMovementPage(1);
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Reseto filtrat
          </button>
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <select
            value={filters.balanceSortBy}
            onChange={(e) => {
              setFilters((current) => ({ ...current, balanceSortBy: e.target.value }));
              setBalancePage(1);
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="updatedAt">Snapshot: Perditesimi</option>
            <option value="warehouse">Snapshot: Magazina</option>
            <option value="category">Snapshot: Kategoria</option>
            <option value="item">Snapshot: Artikulli</option>
            <option value="qtyOnHand">Snapshot: Sasia</option>
            <option value="avgCost">Snapshot: Kosto mesatare</option>
          </select>
          <select
            value={filters.balanceSortOrder}
            onChange={(e) => {
              setFilters((current) => ({
                ...current,
                balanceSortOrder: e.target.value as 'asc' | 'desc',
              }));
              setBalancePage(1);
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="desc">Snapshot: Zbrites</option>
            <option value="asc">Snapshot: Rrites</option>
          </select>
          <select
            value={filters.movementSortBy}
            onChange={(e) => {
              setFilters((current) => ({ ...current, movementSortBy: e.target.value }));
              setMovementPage(1);
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="movementAt">Levizjet: Data</option>
            <option value="warehouse">Levizjet: Magazina</option>
            <option value="category">Levizjet: Kategoria</option>
            <option value="item">Levizjet: Artikulli</option>
            <option value="movementType">Levizjet: Tipi</option>
            <option value="referenceNo">Levizjet: Referenca</option>
          </select>
          <select
            value={filters.movementSortOrder}
            onChange={(e) => {
              setFilters((current) => ({
                ...current,
                movementSortOrder: e.target.value as 'asc' | 'desc',
              }));
              setMovementPage(1);
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="desc">Levizjet: Zbrites</option>
            <option value="asc">Levizjet: Rrites</option>
          </select>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <SummaryCard
          label="Snapshot Rows"
          value={String(balanceSummary.rowCount)}
          sub={`${balanceSummary.categoryCount} kategori ne scope`}
        />
        <SummaryCard
          label="Sasia ne Stok"
          value={formatQty(balanceSummary.totalQty)}
          sub={`${balanceSummary.itemCount} artikuj ne scope`}
        />
        <SummaryCard
          label="Vlera e Stokut"
          value={`${formatMoney(balanceSummary.totalValue)} EUR`}
          sub={`${balanceSummary.warehouseCount} magazina ne scope`}
        />
        <SummaryCard
          label="Levizje ne Scope"
          value={String(movementSummary.movementCount)}
          sub={`Ref: ${movementSummary.referenceCount}`}
        />
        <SummaryCard
          label="Hyrje Totale"
          value={formatQty(movementSummary.totalIn)}
          sub="Sasia e hyre ne periudhen/filtrat e zgjedhur"
        />
        <SummaryCard
          label="Dalje Totale"
          value={formatQty(movementSummary.totalOut)}
          sub="Sasia e dale ne periudhen/filtrat e zgjedhur"
        />
        <SummaryCard
          label="Bilanci Neto"
          value={formatQty(movementSummary.netQty)}
          sub={`${movementSummary.categoryCount} kategori ne levizje`}
        />
        <SummaryCard
          label="Levizja e Fundit"
          value={movementSummary.latestMovementAt ? formatDateTime(movementSummary.latestMovementAt) : '-'}
          sub={`${movementSummary.warehouseCount} magazina / ${movementSummary.itemCount} artikuj`}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <BreakdownPanel
          title="Kategorite me peshe me te madhe"
          description="Kjo pamje tregon ku eshte perqendruar vlera dhe sasia e stokut brenda scope-it aktual."
          emptyText="Nuk ka kategori per filtrat aktuale."
        >
          {balanceSummary.topCategories.length > 0 ? (
            <div className="space-y-3">
              {balanceSummary.topCategories.map((row, index) => (
                <div
                  key={`${row.category?.id ?? 'uncategorized'}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {row.category?.name ?? 'Pa kategori'}
                    </p>
                    <p className="text-xs text-slate-400">{row.itemCount} artikuj ne scope</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">
                      {formatMoney(row.totalValue)} EUR
                    </p>
                    <p className="text-xs text-slate-400">{formatQty(row.totalQty)} njesi</p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </BreakdownPanel>

        <BreakdownPanel
          title="Shperndarja e levizjeve sipas tipit"
          description="Levizjet materiale ndahen sipas llojit qe te shihet shpejt nese dominon hyrja, dalja apo operacionet e brendshme."
          emptyText="Nuk ka levizje per filtrat aktuale."
        >
          {movementSummary.byType.length > 0 ? (
            <div className="space-y-3">
              {movementSummary.byType.map((row) => (
                <div
                  key={row.movementType}
                  className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <StatusBadge value={row.movementType} />
                    <p className="mt-1 text-xs text-slate-400">{row.count} levizje</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">
                      Neto {formatQty(row.netQty)}
                    </p>
                    <p className="text-xs text-slate-400">
                      Hyrje {formatQty(row.totalIn)} / Dalje {formatQty(row.totalOut)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </BreakdownPanel>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Snapshot i stokut</h2>
              <p className="mt-1 text-sm text-slate-500">
                Pamja e balancave sipas magazines, kategorise dhe artikullit, me kosto mesatare
                dhe vlere orientuese.
              </p>
            </div>
            <p className="text-xs text-slate-400">
              {loading ? 'Duke rifreskuar snapshot-in...' : 'Snapshot i filtruar nga backend.'}
            </p>
          </div>
        </div>

        {loading && !balances ? (
          <div className="rounded-xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-400">
            Duke ngarkuar snapshot-in e stokut...
          </div>
        ) : balances && balances.items.length > 0 ? (
          <>
            <DataTable
              data={balances.items}
              columns={[
                {
                  key: 'warehouse',
                  title: 'Magazina',
                  render: (row) => (
                    <div className="min-w-[160px]">
                      <p className="font-medium text-slate-800">{row.warehouse?.name ?? '-'}</p>
                      <p className="text-xs text-slate-400">{row.warehouse?.code ?? '-'}</p>
                    </div>
                  ),
                },
                {
                  key: 'category',
                  title: 'Kategoria',
                  render: (row) => row.item?.category?.name ?? 'Pa kategori',
                },
                {
                  key: 'item',
                  title: 'Artikulli',
                  render: (row) => (
                    <div className="min-w-[220px]">
                      <p className="font-medium text-slate-800">{row.item?.name ?? '-'}</p>
                      <p className="text-xs text-slate-400">{row.item?.code ?? '-'}</p>
                    </div>
                  ),
                },
                {
                  key: 'qtyOnHand',
                  title: 'Sasia',
                  render: (row) => (
                    <div>
                      <p className="font-medium text-slate-900">{formatQty(row.qtyOnHand)}</p>
                      <p className="text-xs text-slate-400">{row.item?.unit?.name ?? '-'}</p>
                    </div>
                  ),
                },
                {
                  key: 'avgCost',
                  title: 'Kosto Mesatare',
                  render: (row) => `${formatMoney(row.avgCost)} EUR`,
                },
                {
                  key: 'stockValue',
                  title: 'Vlera',
                  render: (row) =>
                    `${formatMoney(Number(row.qtyOnHand ?? 0) * Number(row.avgCost ?? 0))} EUR`,
                },
                {
                  key: 'updatedAt',
                  title: 'Perditesuar',
                  render: (row) => formatDateTime(row.updatedAt),
                },
              ]}
            />
            <PaginationFooter
              page={balances.page}
              pageCount={balances.pageCount}
              total={balances.total}
              itemLabel="rreshta snapshot"
              onPrev={() => setBalancePage((current) => Math.max(1, current - 1))}
              onNext={() =>
                setBalancePage((current) => Math.min(balances.pageCount, current + 1))
              }
            />
          </>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-400">
            Nuk ka balanca te stokut per filtrat e zgjedhur.
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Levizjet materiale</h2>
              <p className="mt-1 text-sm text-slate-500">
                Historiku i levizjeve te filtruar sipas magazine, kategorise, artikullit, tipit
                dhe periudhes.
              </p>
            </div>
            <p className="text-xs text-slate-400">
              {loading ? 'Duke rifreskuar levizjet...' : 'Levizjet vijne nga query server-side.'}
            </p>
          </div>
        </div>

        {loading && !movements ? (
          <div className="rounded-xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-400">
            Duke ngarkuar levizjet e stokut...
          </div>
        ) : movements && movements.items.length > 0 ? (
          <>
            <DataTable
              data={movements.items}
              columns={[
                {
                  key: 'movementAt',
                  title: 'Levizur',
                  render: (row) => formatDateTime(row.movementAt),
                },
                {
                  key: 'warehouse',
                  title: 'Magazina',
                  render: (row) => row.warehouse?.name ?? '-',
                },
                {
                  key: 'category',
                  title: 'Kategoria',
                  render: (row) => row.item?.category?.name ?? 'Pa kategori',
                },
                {
                  key: 'item',
                  title: 'Artikulli',
                  render: (row) => (
                    <div className="min-w-[200px]">
                      <p className="font-medium text-slate-800">{row.item?.name ?? '-'}</p>
                      <p className="text-xs text-slate-400">{row.item?.code ?? '-'}</p>
                    </div>
                  ),
                },
                {
                  key: 'movementType',
                  title: 'Tipi',
                  render: (row) => <StatusBadge value={row.movementType} />,
                },
                {
                  key: 'qtyIn',
                  title: 'Hyrje',
                  render: (row) => (
                    <span className="font-medium text-emerald-700">{formatQty(row.qtyIn)}</span>
                  ),
                },
                {
                  key: 'qtyOut',
                  title: 'Dalje',
                  render: (row) => (
                    <span className="font-medium text-rose-700">{formatQty(row.qtyOut)}</span>
                  ),
                },
                {
                  key: 'netQty',
                  title: 'Neto',
                  render: (row) =>
                    formatQty(Number(row.qtyIn ?? 0) - Number(row.qtyOut ?? 0)),
                },
                {
                  key: 'unitCost',
                  title: 'Kosto',
                  render: (row) => `${formatMoney(row.unitCost)} EUR`,
                },
                {
                  key: 'source',
                  title: 'Burimi',
                  render: (row) => {
                    const source = resolveMovementSource(row);

                    if (source.href) {
                      return (
                        <Link
                          href={source.href}
                          className="font-medium text-indigo-700 hover:text-indigo-900"
                        >
                          {source.label}
                        </Link>
                      );
                    }

                    return source.label;
                  },
                },
              ]}
            />
            <PaginationFooter
              page={movements.page}
              pageCount={movements.pageCount}
              total={movements.total}
              itemLabel="levizje"
              onPrev={() => setMovementPage((current) => Math.max(1, current - 1))}
              onNext={() =>
                setMovementPage((current) => Math.min(movements.pageCount, current + 1))
              }
            />
          </>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-400">
            Nuk ka levizje materiale per filtrat e zgjedhur.
          </div>
        )}
      </div>
    </div>
  );
}
