'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { useSession } from '@/components/session-provider';

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

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'adjustment' | 'transfer' | 'count' | null>(null);

  const [adjustment, setAdjustment] = useState({
    warehouseId: '',
    itemId: '',
    qtyChange: '',
    unitCost: '',
    referenceNo: '',
    reason: '',
  });

  const [transfer, setTransfer] = useState({
    fromWarehouseId: '',
    toWarehouseId: '',
    itemId: '',
    qty: '',
    referenceNo: '',
    notes: '',
  });

  const [count, setCount] = useState({
    warehouseId: '',
    itemId: '',
    countedQty: '',
    unitCost: '',
    referenceNo: '',
    notes: '',
  });

  async function submitAdjustment(e: FormEvent) {
    e.preventDefault();
    setBusy('adjustment');
    setError(null);
    setMessage(null);

    try {
      const result = await api.post('stock/adjustments', {
        ...adjustment,
        qtyChange: Number(adjustment.qtyChange),
        unitCost: adjustment.unitCost ? Number(adjustment.unitCost) : undefined,
      });
      setMessage(`Rregullimi u ruajt me reference ${result.referenceNo}.`);
      router.refresh();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(null);
    }
  }

  async function submitTransfer(e: FormEvent) {
    e.preventDefault();
    setBusy('transfer');
    setError(null);
    setMessage(null);

    try {
      const result = await api.post('stock/transfers', {
        ...transfer,
        qty: Number(transfer.qty),
      });
      setMessage(`Transferi u ruajt me reference ${result.referenceNo}.`);
      router.refresh();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(null);
    }
  }

  async function submitCount(e: FormEvent) {
    e.preventDefault();
    setBusy('count');
    setError(null);
    setMessage(null);

    try {
      const result = await api.post('stock/counts', {
        ...count,
        countedQty: Number(count.countedQty),
        unitCost: count.unitCost ? Number(count.unitCost) : undefined,
      });
      setMessage(`Inventarizimi u ruajt me reference ${result.referenceNo}.`);
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

      {canAdjust ? (
        <form onSubmit={submitAdjustment} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Stock Adjustment</h2>
            <p className="text-xs text-slate-500 mt-1">
              Perdor sasi pozitive per shtim dhe negative per ulje.
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
            <input type="text" value={adjustment.reason} onChange={(e) => setAdjustment({ ...adjustment, reason: e.target.value })} placeholder="Arsyeja" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={busy === 'adjustment'} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {busy === 'adjustment' ? 'Duke ruajtur...' : 'Ruaj adjustment'}
            </button>
          </div>
        </form>
      ) : null}

      {canTransfer ? (
        <form onSubmit={submitTransfer} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Warehouse Transfer</h2>
            <p className="text-xs text-slate-500 mt-1">
              Krijon dalje nga magazina burim dhe hyrje ne destinacion me te njejten reference.
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
            <input type="text" value={transfer.notes} onChange={(e) => setTransfer({ ...transfer, notes: e.target.value })} placeholder="Shenime" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={busy === 'transfer'} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {busy === 'transfer' ? 'Duke ruajtur...' : 'Ruaj transferin'}
            </button>
          </div>
        </form>
      ) : null}

      {canAdjust ? (
        <form onSubmit={submitCount} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Stock Counting</h2>
            <p className="text-xs text-slate-500 mt-1">
              Vendos sasine e numeruar dhe sistemi krijon diferencen automatike.
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
            <input type="text" value={count.notes} onChange={(e) => setCount({ ...count, notes: e.target.value })} placeholder="Shenime" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={busy === 'count'} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {busy === 'count' ? 'Duke ruajtur...' : 'Ruaj inventarizimin'}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
