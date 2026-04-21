'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { useSession } from '@/components/session-provider';
import { StatusBadge } from '@/components/status-badge';

type BalanceSnapshot = {
  id: string;
  qtyOnHand: number | string;
  avgCost: number | string;
  updatedAt: string;
  warehouse?: { id: string; name: string; code?: string } | null;
  item?: { id: string; name: string; code?: string } | null;
} | null;

type StockMovement = {
  id: string;
  movementType: string;
  qtyIn: number | string;
  qtyOut: number | string;
  unitCost?: number | string | null;
  referenceNo?: string | null;
  movementAt: string;
  warehouse?: { id: string; name: string } | null;
  item?: { id: string; name: string; code?: string } | null;
};

type LatestResult =
  | {
      kind: 'adjustment';
      referenceNo: string;
      warehouseName: string;
      itemName: string;
      previousQty: number;
      currentQty: number;
      qtyChange: number;
      movementType: string;
    }
  | {
      kind: 'transfer';
      referenceNo: string;
      itemName: string;
      qty: number;
      fromWarehouseName: string;
      toWarehouseName: string;
      fromQty: number;
      toQty: number;
    }
  | {
      kind: 'count';
      referenceNo: string;
      warehouseName: string;
      itemName: string;
      previousQty: number;
      countedQty: number;
      difference: number;
      movementType: string | null;
    };

type PaginatedResponse<T> = {
  items: T[];
};

function parseApiError(error: unknown) {
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message);
      if (typeof parsed.message === 'string') return parsed.message;
    } catch {}
    return error.message;
  }

  return 'Ndodhi nje gabim.';
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

async function loadBalanceSnapshot(warehouseId?: string, itemId?: string): Promise<BalanceSnapshot> {
  if (!warehouseId || !itemId) return null;

  const payload = (await api.listPage('stock/balance', {
    warehouseId,
    itemId,
    page: 1,
    limit: 1,
  })) as PaginatedResponse<BalanceSnapshot>;

  return payload.items[0] ?? null;
}

function SnapshotCard({
  title,
  snapshot,
  emptyText,
}: {
  title: string;
  snapshot: BalanceSnapshot;
  emptyText: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      {snapshot ? (
        <div className="mt-2 space-y-1.5">
          <p className="text-sm font-semibold text-slate-900">
            {snapshot.item?.code ? `[${snapshot.item.code}] ` : ''}
            {snapshot.item?.name ?? 'Artikull'}
          </p>
          <p className="text-sm text-slate-600">{snapshot.warehouse?.name ?? '-'}</p>
          <p className="text-sm text-slate-700">
            Sasia aktuale: <span className="font-semibold text-slate-900">{formatQty(snapshot.qtyOnHand)}</span>
          </p>
          <p className="text-sm text-slate-700">
            Kosto mesatare: <span className="font-semibold text-slate-900">{formatMoney(snapshot.avgCost)} EUR</span>
          </p>
          <p className="text-xs text-slate-400">Perditesuar: {formatDateTime(snapshot.updatedAt)}</p>
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-400">{emptyText}</p>
      )}
    </div>
  );
}

function RecentMovementsCard({ items }: { items: StockMovement[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Lëvizjet e Operacionit</h2>
          <p className="text-xs text-slate-500 mt-1">
            Rreshtat e gjeneruar ne stok nga operacioni i fundit i ruajtur.
          </p>
        </div>
        <Link
          href="/stock/movements"
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          Hap levizjet
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-8 text-sm text-slate-400">Nuk ka levizje per t'u shfaqur ende.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5">Tipi</th>
                <th className="px-4 py-2.5">Magazina</th>
                <th className="px-4 py-2.5">Artikulli</th>
                <th className="px-4 py-2.5 text-right">Hyrje</th>
                <th className="px-4 py-2.5 text-right">Dalje</th>
                <th className="px-4 py-2.5 text-right">Kosto</th>
                <th className="px-4 py-2.5">Koha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map((movement) => (
                <tr key={movement.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-2.5">
                    <StatusBadge value={movement.movementType} />
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{movement.warehouse?.name ?? '-'}</td>
                  <td className="px-4 py-2.5 text-slate-700">
                    {movement.item?.code ? `[${movement.item.code}] ` : ''}
                    {movement.item?.name ?? '-'}
                  </td>
                  <td className="px-4 py-2.5 text-right text-emerald-700">{formatQty(movement.qtyIn)}</td>
                  <td className="px-4 py-2.5 text-right text-rose-700">{formatQty(movement.qtyOut)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600">{formatMoney(movement.unitCost)} EUR</td>
                  <td className="px-4 py-2.5 text-slate-600">{formatDateTime(movement.movementAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LatestResultCard({ result }: { result: LatestResult | null }) {
  if (!result) return null;

  if (result.kind === 'adjustment') {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-emerald-900">Rregullimi u ruajt</h2>
            <p className="text-xs text-emerald-700 mt-1">Referenca: {result.referenceNo}</p>
          </div>
          <StatusBadge value={result.movementType} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
          <div><span className="text-emerald-700">Magazina:</span> <strong className="text-emerald-950">{result.warehouseName}</strong></div>
          <div><span className="text-emerald-700">Artikulli:</span> <strong className="text-emerald-950">{result.itemName}</strong></div>
          <div><span className="text-emerald-700">Para:</span> <strong className="text-emerald-950">{formatQty(result.previousQty)}</strong></div>
          <div><span className="text-emerald-700">Pas:</span> <strong className="text-emerald-950">{formatQty(result.currentQty)}</strong></div>
        </div>
      </div>
    );
  }

  if (result.kind === 'transfer') {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
        <h2 className="text-sm font-semibold text-emerald-900">Transferi u ruajt</h2>
        <p className="text-xs text-emerald-700">Referenca: {result.referenceNo}</p>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm">
          <div><span className="text-emerald-700">Artikulli:</span> <strong className="text-emerald-950">{result.itemName}</strong></div>
          <div><span className="text-emerald-700">Sasia:</span> <strong className="text-emerald-950">{formatQty(result.qty)}</strong></div>
          <div><span className="text-emerald-700">Burimi:</span> <strong className="text-emerald-950">{result.fromWarehouseName}</strong></div>
          <div><span className="text-emerald-700">Mbeti:</span> <strong className="text-emerald-950">{formatQty(result.fromQty)}</strong></div>
          <div><span className="text-emerald-700">Destinacioni:</span> <strong className="text-emerald-950">{result.toWarehouseName} ({formatQty(result.toQty)})</strong></div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-emerald-900">Inventarizimi u ruajt</h2>
          <p className="text-xs text-emerald-700 mt-1">Referenca: {result.referenceNo}</p>
        </div>
        {result.movementType ? <StatusBadge value={result.movementType} /> : null}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm">
        <div><span className="text-emerald-700">Magazina:</span> <strong className="text-emerald-950">{result.warehouseName}</strong></div>
        <div><span className="text-emerald-700">Artikulli:</span> <strong className="text-emerald-950">{result.itemName}</strong></div>
        <div><span className="text-emerald-700">Sasia para:</span> <strong className="text-emerald-950">{formatQty(result.previousQty)}</strong></div>
        <div><span className="text-emerald-700">Sasia e numeruar:</span> <strong className="text-emerald-950">{formatQty(result.countedQty)}</strong></div>
        <div><span className="text-emerald-700">Diferenca:</span> <strong className="text-emerald-950">{formatQty(result.difference)}</strong></div>
      </div>
    </div>
  );
}

export function StockOperationsClient({
  warehouses,
  items,
}: {
  warehouses: any[];
  items: any[];
}) {
  const router = useRouter();
  const { user } = useSession();
  const canAdjust = hasPermission(user?.permissions, PERMISSIONS.stockAdjust);
  const canTransfer = hasPermission(user?.permissions, PERMISSIONS.stockTransfer);
  const today = new Date().toISOString().slice(0, 10);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'adjustment' | 'transfer' | 'count' | null>(null);
  const [latestResult, setLatestResult] = useState<LatestResult | null>(null);
  const [recentMovements, setRecentMovements] = useState<StockMovement[]>([]);

  const [adjustmentSnapshot, setAdjustmentSnapshot] = useState<BalanceSnapshot>(null);
  const [transferSourceSnapshot, setTransferSourceSnapshot] = useState<BalanceSnapshot>(null);
  const [transferDestinationSnapshot, setTransferDestinationSnapshot] = useState<BalanceSnapshot>(null);
  const [countSnapshot, setCountSnapshot] = useState<BalanceSnapshot>(null);

  const [adjustment, setAdjustment] = useState({
    warehouseId: '',
    itemId: '',
    qtyChange: '',
    unitCost: '',
    referenceNo: '',
    reason: '',
    movementAt: today,
  });

  const [transfer, setTransfer] = useState({
    fromWarehouseId: '',
    toWarehouseId: '',
    itemId: '',
    qty: '',
    referenceNo: '',
    notes: '',
    movementAt: today,
  });

  const [count, setCount] = useState({
    warehouseId: '',
    itemId: '',
    countedQty: '',
    unitCost: '',
    referenceNo: '',
    notes: '',
    countedAt: today,
  });

  useEffect(() => {
    let active = true;
    void loadBalanceSnapshot(adjustment.warehouseId, adjustment.itemId).then((snapshot) => {
      if (active) setAdjustmentSnapshot(snapshot);
    });
    return () => {
      active = false;
    };
  }, [adjustment.warehouseId, adjustment.itemId]);

  useEffect(() => {
    let active = true;
    void loadBalanceSnapshot(transfer.fromWarehouseId, transfer.itemId).then((snapshot) => {
      if (active) setTransferSourceSnapshot(snapshot);
    });
    return () => {
      active = false;
    };
  }, [transfer.fromWarehouseId, transfer.itemId]);

  useEffect(() => {
    let active = true;
    void loadBalanceSnapshot(transfer.toWarehouseId, transfer.itemId).then((snapshot) => {
      if (active) setTransferDestinationSnapshot(snapshot);
    });
    return () => {
      active = false;
    };
  }, [transfer.toWarehouseId, transfer.itemId]);

  useEffect(() => {
    let active = true;
    void loadBalanceSnapshot(count.warehouseId, count.itemId).then((snapshot) => {
      if (active) setCountSnapshot(snapshot);
    });
    return () => {
      active = false;
    };
  }, [count.warehouseId, count.itemId]);

  async function loadRecentOperationMovements(referenceNo: string) {
    const payload = (await api.listPage('stock/movements', {
      search: referenceNo,
      page: 1,
      limit: 10,
      sortBy: 'movementAt',
      sortOrder: 'desc',
    })) as PaginatedResponse<StockMovement>;

    setRecentMovements(payload.items);
  }

  async function submitAdjustment(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!adjustment.warehouseId || !adjustment.itemId) {
      setError('Zgjidh magazinen dhe artikullin per rregullim.');
      return;
    }

    const qtyChange = Number(adjustment.qtyChange);
    if (!Number.isFinite(qtyChange) || qtyChange === 0) {
      setError('Shkruaj nje ndryshim valid te sasise.');
      return;
    }

    const availableQty = Number(adjustmentSnapshot?.qtyOnHand ?? 0);
    if (qtyChange < 0 && availableQty < Math.abs(qtyChange)) {
      setError('Ulja e stokut e kalon sasine aktuale ne magazine.');
      return;
    }

    setBusy('adjustment');

    try {
      const result = await api.post('stock/adjustments', {
        warehouseId: adjustment.warehouseId,
        itemId: adjustment.itemId,
        qtyChange,
        unitCost: adjustment.unitCost ? Number(adjustment.unitCost) : undefined,
        referenceNo: adjustment.referenceNo || undefined,
        reason: adjustment.reason || undefined,
        movementAt: adjustment.movementAt || undefined,
      });

      setLatestResult({
        kind: 'adjustment',
        referenceNo: result.referenceNo,
        warehouseName: result.warehouse?.name ?? '-',
        itemName: result.item?.name ?? '-',
        previousQty: Number(result.previousQty ?? 0),
        currentQty: Number(result.currentQty ?? 0),
        qtyChange: Number(result.qtyChange ?? 0),
        movementType: result.movementType,
      });
      await loadRecentOperationMovements(result.referenceNo);
      setMessage(`Rregullimi u ruajt me reference ${result.referenceNo}.`);
      setAdjustment((current) => ({
        ...current,
        qtyChange: '',
        unitCost: '',
        referenceNo: '',
        reason: '',
      }));
      router.refresh();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(null);
    }
  }

  async function submitTransfer(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!transfer.fromWarehouseId || !transfer.toWarehouseId || !transfer.itemId) {
      setError('Zgjidh magazinen burim, destinacionin dhe artikullin per transfer.');
      return;
    }

    if (transfer.fromWarehouseId === transfer.toWarehouseId) {
      setError('Magazina burim dhe destinacioni duhet te jene te ndryshme.');
      return;
    }

    const qty = Number(transfer.qty);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Shkruaj nje sasi valide per transfer.');
      return;
    }

    const availableQty = Number(transferSourceSnapshot?.qtyOnHand ?? 0);
    if (availableQty < qty) {
      setError('Sasia e transferit e kalon stokun aktual ne magazinen burim.');
      return;
    }

    setBusy('transfer');

    try {
      const result = await api.post('stock/transfers', {
        fromWarehouseId: transfer.fromWarehouseId,
        toWarehouseId: transfer.toWarehouseId,
        itemId: transfer.itemId,
        qty,
        referenceNo: transfer.referenceNo || undefined,
        notes: transfer.notes || undefined,
        movementAt: transfer.movementAt || undefined,
      });

      setLatestResult({
        kind: 'transfer',
        referenceNo: result.referenceNo,
        itemName: result.item?.name ?? '-',
        qty: Number(result.qty ?? 0),
        fromWarehouseName: result.fromWarehouse?.name ?? '-',
        toWarehouseName: result.toWarehouse?.name ?? '-',
        fromQty: Number(result.balances?.from ?? 0),
        toQty: Number(result.balances?.to ?? 0),
      });
      await loadRecentOperationMovements(result.referenceNo);
      setMessage(`Transferi u ruajt me reference ${result.referenceNo}.`);
      setTransfer((current) => ({
        ...current,
        qty: '',
        referenceNo: '',
        notes: '',
      }));
      router.refresh();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(null);
    }
  }

  async function submitCount(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!count.warehouseId || !count.itemId) {
      setError('Zgjidh magazinen dhe artikullin per inventarizim.');
      return;
    }

    const countedQty = Number(count.countedQty);
    if (!Number.isFinite(countedQty) || countedQty < 0) {
      setError('Shkruaj nje sasi te numeruar valide.');
      return;
    }

    setBusy('count');

    try {
      const result = await api.post('stock/counts', {
        warehouseId: count.warehouseId,
        itemId: count.itemId,
        countedQty,
        unitCost: count.unitCost ? Number(count.unitCost) : undefined,
        referenceNo: count.referenceNo || undefined,
        notes: count.notes || undefined,
        countedAt: count.countedAt || undefined,
      });

      setLatestResult({
        kind: 'count',
        referenceNo: result.referenceNo,
        warehouseName: result.warehouse?.name ?? '-',
        itemName: result.item?.name ?? '-',
        previousQty: Number(result.previousQty ?? 0),
        countedQty: Number(result.countedQty ?? 0),
        difference: Number(result.difference ?? 0),
        movementType: result.movementType,
      });
      await loadRecentOperationMovements(result.referenceNo);
      setMessage(`Inventarizimi u ruajt me reference ${result.referenceNo}.`);
      setCount((current) => ({
        ...current,
        countedQty: '',
        unitCost: '',
        referenceNo: '',
        notes: '',
      }));
      router.refresh();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(null);
    }
  }

  if (!canAdjust && !canTransfer) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Nuk keni te drejta per operacionet e stokut.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Qendra e Operacioneve</h2>
            <p className="text-sm text-slate-500 mt-1">
              Rregullo stokun, lëvize mes magazinave dhe mbyll inventarizimin me preview te sasisë aktuale.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/stock/balances"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Gjendja e stokut
            </Link>
            <Link
              href="/stock/movements"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Levizjet
            </Link>
          </div>
        </div>
      </div>

      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <LatestResultCard result={latestResult} />

      {canAdjust ? (
        <div className="grid grid-cols-1 xl:grid-cols-[1.7fr_1fr] gap-4">
          <form onSubmit={submitAdjustment} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Rregullim Stoku</h2>
              <p className="text-xs text-slate-500 mt-1">
                Perdor sasi pozitive per shtim dhe negative per ulje. Kontrolli i stokut behet para ruajtjes.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select value={adjustment.warehouseId} onChange={(e) => setAdjustment({ ...adjustment, warehouseId: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">Zgjidh magazinen</option>
                {warehouses.map((warehouse: any) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
              </select>
              <select value={adjustment.itemId} onChange={(e) => setAdjustment({ ...adjustment, itemId: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">Zgjidh artikullin</option>
                {items.map((item: any) => <option key={item.id} value={item.id}>{item.code ? `[${item.code}] ` : ''}{item.name}</option>)}
              </select>
              <input type="number" step="0.001" value={adjustment.qtyChange} onChange={(e) => setAdjustment({ ...adjustment, qtyChange: e.target.value })} placeholder="Ndryshimi i sasise" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input type="number" step="0.01" value={adjustment.unitCost} onChange={(e) => setAdjustment({ ...adjustment, unitCost: e.target.value })} placeholder="Kosto opsionale" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input type="text" value={adjustment.referenceNo} onChange={(e) => setAdjustment({ ...adjustment, referenceNo: e.target.value })} placeholder="Reference" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input type="date" value={adjustment.movementAt} onChange={(e) => setAdjustment({ ...adjustment, movementAt: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input type="text" value={adjustment.reason} onChange={(e) => setAdjustment({ ...adjustment, reason: e.target.value })} placeholder="Arsyeja e rregullimit" className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-3" />
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={busy === 'adjustment'} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                {busy === 'adjustment' ? 'Duke ruajtur...' : 'Ruaj rregullimin'}
              </button>
            </div>
          </form>

          <SnapshotCard
            title="Gjendja aktuale"
            snapshot={adjustmentSnapshot}
            emptyText="Zgjidh magazinen dhe artikullin per te pare stokun aktual."
          />
        </div>
      ) : null}

      {canTransfer ? (
        <div className="grid grid-cols-1 xl:grid-cols-[1.7fr_1fr] gap-4">
          <form onSubmit={submitTransfer} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Transfer Magazinash</h2>
              <p className="text-xs text-slate-500 mt-1">
                Krijon dalje nga magazina burim dhe hyrje ne destinacion me te njejten reference operative.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select value={transfer.fromWarehouseId} onChange={(e) => setTransfer({ ...transfer, fromWarehouseId: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">Nga magazina</option>
                {warehouses.map((warehouse: any) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
              </select>
              <select value={transfer.toWarehouseId} onChange={(e) => setTransfer({ ...transfer, toWarehouseId: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">Ne magazine</option>
                {warehouses.map((warehouse: any) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
              </select>
              <select value={transfer.itemId} onChange={(e) => setTransfer({ ...transfer, itemId: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">Zgjidh artikullin</option>
                {items.map((item: any) => <option key={item.id} value={item.id}>{item.code ? `[${item.code}] ` : ''}{item.name}</option>)}
              </select>
              <input type="number" step="0.001" value={transfer.qty} onChange={(e) => setTransfer({ ...transfer, qty: e.target.value })} placeholder="Sasia" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input type="text" value={transfer.referenceNo} onChange={(e) => setTransfer({ ...transfer, referenceNo: e.target.value })} placeholder="Reference" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input type="date" value={transfer.movementAt} onChange={(e) => setTransfer({ ...transfer, movementAt: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input type="text" value={transfer.notes} onChange={(e) => setTransfer({ ...transfer, notes: e.target.value })} placeholder="Shenime operative" className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-3" />
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={busy === 'transfer'} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                {busy === 'transfer' ? 'Duke ruajtur...' : 'Ruaj transferin'}
              </button>
            </div>
          </form>

          <div className="space-y-4">
            <SnapshotCard
              title="Magazina burim"
              snapshot={transferSourceSnapshot}
              emptyText="Zgjidh magazinen burim dhe artikullin."
            />
            <SnapshotCard
              title="Magazina destinacion"
              snapshot={transferDestinationSnapshot}
              emptyText="Zgjidh magazinen destinacion dhe artikullin."
            />
          </div>
        </div>
      ) : null}

      {canAdjust ? (
        <div className="grid grid-cols-1 xl:grid-cols-[1.7fr_1fr] gap-4">
          <form onSubmit={submitCount} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Inventarizim</h2>
              <p className="text-xs text-slate-500 mt-1">
                Vendos sasine e numeruar dhe sistemi gjeneron automatikisht diferencen ne stok.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select value={count.warehouseId} onChange={(e) => setCount({ ...count, warehouseId: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">Zgjidh magazinen</option>
                {warehouses.map((warehouse: any) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
              </select>
              <select value={count.itemId} onChange={(e) => setCount({ ...count, itemId: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">Zgjidh artikullin</option>
                {items.map((item: any) => <option key={item.id} value={item.id}>{item.code ? `[${item.code}] ` : ''}{item.name}</option>)}
              </select>
              <input type="number" step="0.001" value={count.countedQty} onChange={(e) => setCount({ ...count, countedQty: e.target.value })} placeholder="Sasia e numeruar" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input type="number" step="0.01" value={count.unitCost} onChange={(e) => setCount({ ...count, unitCost: e.target.value })} placeholder="Kosto opsionale" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input type="text" value={count.referenceNo} onChange={(e) => setCount({ ...count, referenceNo: e.target.value })} placeholder="Reference" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input type="date" value={count.countedAt} onChange={(e) => setCount({ ...count, countedAt: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input type="text" value={count.notes} onChange={(e) => setCount({ ...count, notes: e.target.value })} placeholder="Shenime operative" className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-3" />
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={busy === 'count'} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                {busy === 'count' ? 'Duke ruajtur...' : 'Ruaj inventarizimin'}
              </button>
            </div>
          </form>

          <SnapshotCard
            title="Gjendja para numerimit"
            snapshot={countSnapshot}
            emptyText="Zgjidh magazinen dhe artikullin per te pare gjendjen aktuale."
          />
        </div>
      ) : null}

      <RecentMovementsCard items={recentMovements} />
    </div>
  );
}
