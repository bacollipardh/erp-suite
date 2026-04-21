'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { PdfButtons } from '@/components/invoices/pdf-download-button';

// ─── Types ────────────────────────────────────────────────────────────────────
type Item = {
  id: string;
  name: string;
  code?: string;
  barcode?: string;
  standardSalesPrice?: number;
  taxRate?: { ratePercent: number };
};
type Customer    = { id: string; name: string; code?: string };
type Warehouse   = { id: string; name: string };
type PayMethod   = { id: string; name: string };
type Series      = { id: string; prefix: string; nextNumber: number };

type CartLine = {
  itemId: string;
  name: string;
  code: string;
  qty: number;
  unitPrice: number;
  discountPercent: number;
  taxPercent: number;
};

function calcLine(l: CartLine) {
  const base = l.qty * l.unitPrice;
  const disc = base * (l.discountPercent / 100);
  const net  = base - disc;
  const tax  = net * (l.taxPercent / 100);
  return { net, tax, gross: net + tax };
}

// ─── Component ────────────────────────────────────────────────────────────────
export function PosForm({
  items,
  customers,
  warehouses,
  paymentMethods,
  series,
}: {
  items: Item[];
  customers: Customer[];
  warehouses: Warehouse[];
  paymentMethods: PayMethod[];
  series: Series[];
}) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);

  // Header state
  const [customerId, setCustomerId]       = useState('');
  const [customerQ, setCustomerQ]         = useState('');
  const [showCustDD, setShowCustDD]       = useState(false);
  const [warehouseId, setWarehouseId]     = useState(warehouses[0]?.id ?? '');
  const [payMethodId, setPayMethodId]     = useState(paymentMethods[0]?.id ?? '');
  const [seriesId, setSeriesId]           = useState(series[0]?.id ?? '');
  const [notes, setNotes]                 = useState('');

  // Cart
  const [cart, setCart] = useState<CartLine[]>([]);

  // Item search
  const [search, setSearch]               = useState('');
  const [showItemDD, setShowItemDD]       = useState(false);

  // UI
  const [busy, setBusy]                   = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [success, setSuccess]             = useState<{ id: string; docNo: string } | null>(null);

  // ── Customer dropdown ───────────────────────────────────────────────────────
  const custResults = useMemo(() => {
    if (!customerQ.trim()) return customers.slice(0, 10);
    const q = customerQ.toLowerCase();
    return customers
      .filter(c => c.name.toLowerCase().includes(q) || (c.code ?? '').toLowerCase().includes(q))
      .slice(0, 10);
  }, [customerQ, customers]);

  const selectedCustomer = customers.find(c => c.id === customerId);

  // ── Item search ─────────────────────────────────────────────────────────────
  const itemResults = useMemo(() => {
    const q = search.trim();
    if (!q) return [];
    const lower = q.toLowerCase();
    return items.filter(i =>
      i.barcode === q ||
      (i.code ?? '').toLowerCase().includes(lower) ||
      i.name.toLowerCase().includes(lower)
    ).slice(0, 8);
  }, [search, items]);

  // Barcode exact match → auto-add
  useEffect(() => {
    if (itemResults.length === 1 && itemResults[0].barcode === search.trim()) {
      addToCart(itemResults[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemResults]);

  // Show dropdown when there are results
  useEffect(() => {
    setShowItemDD(itemResults.length > 0 && search.trim().length > 0);
  }, [itemResults, search]);

  // ── Cart helpers ─────────────────────────────────────────────────────────────
  const addToCart = useCallback((item: Item) => {
    setCart(prev => {
      const idx = prev.findIndex(l => l.itemId === item.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: +(next[idx].qty + 1).toFixed(3) };
        return next;
      }
      return [...prev, {
        itemId: item.id,
        name: item.name,
        code: item.code ?? '',
        qty: 1,
        unitPrice: Number(item.standardSalesPrice ?? 0),
        discountPercent: 0,
        taxPercent: Number(item.taxRate?.ratePercent ?? 0),
      }];
    });
    setSearch('');
    setShowItemDD(false);
    setTimeout(() => searchRef.current?.focus(), 30);
  }, []);

  function updateLine(idx: number, patch: Partial<CartLine>) {
    setCart(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }

  function removeLine(idx: number) {
    setCart(prev => prev.filter((_, i) => i !== idx));
  }

  // ── Totals ───────────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const lines = cart.map(calcLine);
    return {
      subtotal:  lines.reduce((a, b) => a + b.net,   0),
      taxTotal:  lines.reduce((a, b) => a + b.tax,   0),
      grandTotal:lines.reduce((a, b) => a + b.gross, 0),
    };
  }, [cart]);

  // ── Submit ────────────────────────────────────────────────────────────────────
async function handleSubmit() {
    if (!customerId)     { setError('Zgjidhni klientin.');          return; }
    if (!cart.length)    { setError('Shto të paktën 1 artikull.'); return; }
    if (!warehouseId)    { setError('Zgjidhni magazinën.');        return; }
    if (!seriesId)       { setError('Zgjidhni serinë e dokumentit.'); return; }

    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: Record<string, unknown> = {
        seriesId,
        customerId,
        warehouseId,
        docDate: new Date().toISOString().slice(0, 10),
        lines: cart.map(l => ({
          itemId: l.itemId,
          qty: l.qty,
          unitPrice: l.unitPrice,
          discountPercent: l.discountPercent,
          taxPercent: l.taxPercent,
        })),
      };
      if (payMethodId) payload.paymentMethodId = payMethodId;
      if (notes.trim()) payload.notes = notes.trim();

      const invoice = await api.create('sales-invoices', payload);
      await api.postDocument('sales-invoices', invoice.id);

      setSuccess({ id: invoice.id, docNo: invoice.docNo });
      setCart([]);
      setCustomerId('');
      setCustomerQ('');
      setNotes('');
      router.refresh();
    } catch (err: any) {
      try { setError(JSON.parse(err.message).message ?? err.message); }
      catch { setError(err.message ?? 'Gabim gjatë krijimit të faturës.'); }
    } finally {
      setBusy(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* ── Success ── */}
      {success && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-emerald-700 font-medium text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Fatura <strong className="mx-1">{success.docNo}</strong> u krijua dhe u postua!
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <PdfButtons
              baseHref={`/api/proxy/pdf/sales-invoices/${success.id}`}
              docNo={success.docNo}
            />
            <button
              onClick={() => setSuccess(null)}
              className="text-xs text-emerald-600 hover:text-emerald-800 px-2 py-1 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              Mbyll
            </button>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</div>
      )}

      {/* ── Main layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ─── LEFT: details + totals ─── */}
        <div className="space-y-3">
          {/* Header fields */}
          <div className="rounded-xl border bg-white p-4 space-y-3 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800">Detajet e Shitjes</h2>

            {/* Customer */}
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Blerësi</label>
              {customerId ? (
                <div className="flex items-center justify-between rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm">
                  <span className="font-medium text-emerald-800">{selectedCustomer?.name}</span>
                  <button
                    onClick={() => { setCustomerId(''); setCustomerQ(''); }}
                    className="text-emerald-400 hover:text-red-500 transition-colors ml-2 shrink-0"
                    title="Hiq blerësin"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Kërko emrin ose kodin..."
                    value={customerQ}
                    onChange={e => { setCustomerQ(e.target.value); setShowCustDD(true); }}
                    onFocus={() => setShowCustDD(true)}
                    onBlur={() => setTimeout(() => setShowCustDD(false), 150)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-colors"
                  />
                  {showCustDD && custResults.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
                      {custResults.map(c => (
                        <button
                          key={c.id}
                          onMouseDown={() => { setCustomerId(c.id); setCustomerQ(''); setShowCustDD(false); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 hover:text-indigo-700 border-b last:border-b-0 transition-colors flex items-center justify-between"
                        >
                          <span>{c.name}</span>
                          {c.code && <span className="text-xs text-slate-400 ml-2 shrink-0">{c.code}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <p className="text-xs text-slate-400 mt-0.5">Klienti është i detyrueshëm për faturimin e POS-it.</p>
            </div>

            {/* Warehouse */}
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Magazina *</label>
              <select
                value={warehouseId}
                onChange={e => setWarehouseId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-colors"
              >
                <option value="">— Zgjidhni —</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>

            {/* Payment method */}
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Metoda e Pagesës</label>
              <select
                value={payMethodId}
                onChange={e => setPayMethodId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-colors"
              >
                <option value="">— Zgjidhni —</option>
                {paymentMethods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            {/* Series */}
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Seria e Dokumentit *</label>
              <select
                value={seriesId}
                onChange={e => setSeriesId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-colors"
              >
                <option value="">— Zgjidhni —</option>
                {series.map(s => (
                  <option key={s.id} value={s.id}>{s.prefix} · Radhës: {s.nextNumber}</option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Shënime</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Shënime opsionale..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-colors"
              />
            </div>
          </div>

          {/* Totals + submit */}
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">Totalet</h2>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Nëntotali</span>
                <span className="tabular-nums font-medium">{totals.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>TVSH</span>
                <span className="tabular-nums font-medium">{totals.taxTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-slate-900 pt-2 mt-2 border-t border-slate-200">
                <span>Totali</span>
                <span className="tabular-nums">{totals.grandTotal.toFixed(2)} €</span>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={busy || cart.length === 0}
              className="w-full mt-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white py-3 text-sm font-semibold disabled:opacity-40 transition-colors shadow-sm"
            >
              {busy ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Duke krijuar...
                </span>
              ) : (
                `✓ Krijo & Posto Faturën${cart.length ? ` (${cart.length} art.)` : ''}`
              )}
            </button>
          </div>
        </div>

        {/* ─── RIGHT: search + cart ─── */}
        <div className="lg:col-span-2 space-y-3">
          {/* Item search box */}
          <div className="rounded-xl border bg-white p-3 shadow-sm">
            <div className="relative">
              <div
                className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 transition-colors bg-slate-50
                  ${showItemDD ? 'border-indigo-500' : 'border-slate-200 focus-within:border-indigo-400'}`}
              >
                {/* Barcode icon */}
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-indigo-400 shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75V16.5zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
                </svg>

                <input
                  ref={searchRef}
                  autoFocus
                  type="text"
                  placeholder="Kërko artikullin — emër, kod ose barkod (Enter për të shtuar)"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onFocus={() => search && setShowItemDD(itemResults.length > 0)}
                  onBlur={() => setTimeout(() => setShowItemDD(false), 150)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && itemResults.length === 1) addToCart(itemResults[0]);
                    if (e.key === 'Escape') { setSearch(''); setShowItemDD(false); }
                  }}
                  className="flex-1 bg-transparent text-slate-800 placeholder:text-slate-400 text-sm focus:outline-none"
                />

                {search ? (
                  <button
                    onClick={() => { setSearch(''); setShowItemDD(false); searchRef.current?.focus(); }}
                    className="text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                ) : (
                  <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-slate-200 px-1.5 py-0.5 text-xs font-medium text-slate-400">
                    Enter
                  </kbd>
                )}
              </div>

              {/* Dropdown results */}
              {showItemDD && itemResults.length > 0 && (
                <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border rounded-xl shadow-xl overflow-hidden">
                  {itemResults.map((item, i) => (
                    <button
                      key={item.id}
                      onMouseDown={() => addToCart(item)}
                      className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors border-b last:border-b-0
                        ${i === 0 ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                    >
                      <div className="text-left min-w-0">
                        <span className="font-medium text-slate-800">{item.name}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          {item.code    && <span className="text-xs text-slate-400">Kodi: {item.code}</span>}
                          {item.barcode && <span className="text-xs text-slate-400">Barkod: {item.barcode}</span>}
                        </div>
                      </div>
                      <span className="font-bold text-indigo-600 tabular-nums ml-4 shrink-0">
                        {Number(item.standardSalesPrice ?? 0).toFixed(2)} €
                      </span>
                    </button>
                  ))}
                  {itemResults.length === 1 && (
                    <div className="px-4 py-1.5 text-xs text-slate-400 bg-slate-50 border-t">
                      Shtyp <kbd className="rounded border border-slate-300 px-1 py-0.5 font-medium text-slate-600">Enter</kbd> për të shtuar
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Cart table */}
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b bg-slate-50">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Shporta {cart.length > 0 && `· ${cart.length} artikuj`}
              </span>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                >
                  Pastro
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-14 h-14 text-slate-200 mb-3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                </svg>
                <p className="text-sm font-medium">Shporta është bosh</p>
                <p className="text-xs mt-1">Kërko artikullin nga kutia e mësipërme</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Artikulli</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Çmimi</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-36">Sasia</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-8">Zb%</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Totali</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cart.map((line, idx) => {
                      const { gross } = calcLine(line);
                      return (
                        <tr key={`${line.itemId}-${idx}`} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-4 py-2.5 align-middle">
                            <p className="font-medium text-slate-800 leading-tight">{line.name}</p>
                            {line.code && <p className="text-xs text-slate-400 mt-0.5">{line.code}</p>}
                          </td>
                          <td className="px-3 py-2.5 text-right align-middle">
                            <input
                              type="number"
                              value={line.unitPrice}
                              min={0}
                              step="0.01"
                              onChange={e => updateLine(idx, { unitPrice: Number(e.target.value) })}
                              className="w-24 text-right rounded-lg border border-slate-200 px-2 py-1 text-sm tabular-nums focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/30 transition-colors"
                            />
                          </td>
                          <td className="px-3 py-2.5 align-middle">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => line.qty > 1 ? updateLine(idx, { qty: +(line.qty - 1).toFixed(3) }) : removeLine(idx)}
                                className="w-7 h-7 rounded-lg border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-500 hover:border-red-200 text-sm font-bold flex items-center justify-center transition-colors"
                              >−</button>
                              <input
                                type="number"
                                value={line.qty}
                                min={0.001}
                                step="any"
                                onChange={e => updateLine(idx, { qty: Number(e.target.value) })}
                                className="w-16 text-center rounded-lg border border-slate-200 px-1 py-1 text-sm tabular-nums focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/30 transition-colors"
                              />
                              <button
                                onClick={() => updateLine(idx, { qty: +(line.qty + 1).toFixed(3) })}
                                className="w-7 h-7 rounded-lg border border-slate-200 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 text-sm font-bold flex items-center justify-center transition-colors"
                              >+</button>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right align-middle">
                            <input
                              type="number"
                              value={line.discountPercent}
                              min={0}
                              max={100}
                              step="0.1"
                              onChange={e => updateLine(idx, { discountPercent: Number(e.target.value) })}
                              className="w-14 text-right rounded-lg border border-slate-200 px-1 py-1 text-xs tabular-nums focus:border-indigo-400 transition-colors"
                            />
                          </td>
                          <td className="px-4 py-2.5 text-right align-middle">
                            <span className="font-bold text-slate-800 tabular-nums">{gross.toFixed(2)} €</span>
                          </td>
                          <td className="px-3 py-2.5 text-center align-middle">
                            <button
                              onClick={() => removeLine(idx)}
                              className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                              title="Hiq"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Cart footer total */}
                  <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                    <tr>
                      <td colSpan={4} className="px-4 py-2.5 text-right text-sm font-semibold text-slate-600">Totali i faturës:</td>
                      <td className="px-4 py-2.5 text-right text-base font-bold text-slate-900 tabular-nums">{totals.grandTotal.toFixed(2)} €</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
