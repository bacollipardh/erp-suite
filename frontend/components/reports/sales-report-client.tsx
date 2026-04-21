'use client';

import { useMemo, useState } from 'react';

// ─── helpers ────────────────────────────────────────────────────────────────
function fmt(n: number) { return n.toLocaleString('sq-AL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('sq-AL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── types ────────────────────────────────────────────────────────────────
type Invoice = {
  id: string; docNo: string; docDate: string; createdAt: string; status: string;
  grandTotal: any; subtotal: any; taxTotal: any;
  customer?: { id: string; name: string };
  createdBy?: { id: string; fullName: string };
};

// ─── stat card ─────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = 'indigo' }: { label: string; value: string; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    indigo: 'border-indigo-200 bg-indigo-50',
    emerald:'border-emerald-200 bg-emerald-50',
    amber:  'border-amber-200  bg-amber-50',
    slate:  'border-slate-200  bg-slate-50',
  };
  const textColors: Record<string, string> = {
    indigo: 'text-indigo-700', emerald: 'text-emerald-700',
    amber:  'text-amber-700',  slate:   'text-slate-700',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 tabular-nums ${textColors[color]}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── monthly bar chart (CSS) ─────────────────────────────────────────────────
function MonthlyChart({ invoices }: { invoices: Invoice[] }) {
  const months = useMemo(() => {
    const map: Record<string, number> = {};
    for (const inv of invoices) {
      if (inv.status === 'CANCELLED') continue;
      const d = new Date(inv.docDate ?? inv.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map[key] = (map[key] ?? 0) + Number(inv.grandTotal ?? 0);
    }
    // last 12 months
    const entries = Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).slice(-12);
    const max = Math.max(...entries.map(e => e[1]), 1);
    return entries.map(([key, val]) => ({
      label: new Date(key + '-01').toLocaleDateString('sq-AL', { month: 'short', year: '2-digit' }),
      val, pct: Math.round((val / max) * 100),
    }));
  }, [invoices]);

  if (months.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-700 mb-4">Shitjet Mujore (€)</h2>
      <div className="flex items-end gap-1.5 h-32">
        {months.map((m, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
            <div className="relative w-full flex items-end justify-center" style={{ height: '96px' }}>
              <div
                className="w-full bg-indigo-500 group-hover:bg-indigo-600 rounded-t transition-all duration-200"
                style={{ height: `${Math.max(m.pct, 2)}%` }}
                title={`${m.label}: ${fmt(m.val)} €`}
              />
            </div>
            <span className="text-[9px] text-slate-400 whitespace-nowrap">{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── top customers ────────────────────────────────────────────────────────
function TopCustomers({ invoices }: { invoices: Invoice[] }) {
  const top = useMemo(() => {
    const map: Record<string, { name: string; total: number; count: number }> = {};
    for (const inv of invoices) {
      if (inv.status === 'CANCELLED') continue;
      const key = inv.customer?.id ?? '__none__';
      const name = inv.customer?.name ?? 'Pa blerës';
      if (!map[key]) map[key] = { name, total: 0, count: 0 };
      map[key].total += Number(inv.grandTotal ?? 0);
      map[key].count++;
    }
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [invoices]);

  const maxTotal = Math.max(...top.map(t => t.total), 1);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-700 mb-3">Top Blerësit</h2>
      <div className="space-y-2.5">
        {top.map((t, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-5 text-xs font-bold text-slate-400 shrink-0 text-right">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs font-medium text-slate-700 truncate">{t.name}</span>
                <span className="text-xs font-bold text-indigo-700 tabular-nums ml-2 shrink-0">{fmt(t.total)} €</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-400 rounded-full"
                  style={{ width: `${Math.round((t.total / maxTotal) * 100)}%` }}
                />
              </div>
            </div>
            <span className="text-xs text-slate-400 shrink-0 w-10 text-right">{t.count} fat.</span>
          </div>
        ))}
        {top.length === 0 && <p className="text-sm text-slate-400">Nuk ka të dhëna.</p>}
      </div>
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────
export function SalesReportClient({
  invoices,
  customers,
  users,
}: {
  invoices: Invoice[];
  customers: any[];
  users: any[];
}) {
  // ── Filters ──────────────────────────────────────────────────────────────
  const thisYear = new Date().getFullYear();
  const [dateFrom, setDateFrom]       = useState(`${thisYear}-01-01`);
  const [dateTo, setDateTo]           = useState(new Date().toISOString().slice(0, 10));
  const [customerId, setCustomerId]   = useState('');
  const [userId, setUserId]           = useState('');
  const [statusFilter, setStatus]     = useState('POSTED');  // POSTED | ALL | DRAFT

  // ── Filtered set ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return invoices.filter(inv => {
      const d = inv.docDate ? inv.docDate.slice(0, 10) : (inv.createdAt?.slice(0, 10) ?? '');
      if (dateFrom && d < dateFrom) return false;
      if (dateTo   && d > dateTo)   return false;
      if (customerId && inv.customer?.id !== customerId) return false;
      if (userId     && inv.createdBy?.id !== userId)    return false;
      if (statusFilter !== 'ALL' && inv.status !== statusFilter) return false;
      return true;
    }).sort((a, b) => (b.docDate ?? b.createdAt ?? '').localeCompare(a.docDate ?? a.createdAt ?? ''));
  }, [invoices, dateFrom, dateTo, customerId, userId, statusFilter]);

  // ── Aggregated stats ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const count     = filtered.length;
    const revenue   = filtered.reduce((s, i) => s + Number(i.grandTotal ?? 0), 0);
    const netTotal  = filtered.reduce((s, i) => s + Number(i.subtotal   ?? 0), 0);
    const taxTotal  = filtered.reduce((s, i) => s + Number(i.taxTotal   ?? 0), 0);
    const avg       = count > 0 ? revenue / count : 0;
    return { count, revenue, netTotal, taxTotal, avg };
  }, [filtered]);

  const statusBadge = (s: string) => {
    if (s === 'POSTED')    return 'bg-emerald-100 text-emerald-700';
    if (s === 'DRAFT')     return 'bg-slate-100 text-slate-500';
    if (s === 'CANCELLED') return 'bg-red-100 text-red-500';
    return 'bg-slate-100 text-slate-500';
  };
  const statusLabel = (s: string) => ({ POSTED: 'Postuar', DRAFT: 'Draft', CANCELLED: 'Anuluar' }[s] ?? s);

  return (
    <div className="space-y-4">

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Nga data</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-colors" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Deri më</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-colors" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Blerësi</label>
            <select value={customerId} onChange={e => setCustomerId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-colors">
              <option value="">— Të gjithë —</option>
              {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Agjenti</label>
            <select value={userId} onChange={e => setUserId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-colors">
              <option value="">— Të gjithë —</option>
              {users.map((u: any) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Statusi</label>
            <select value={statusFilter} onChange={e => setStatus(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-colors">
              <option value="POSTED">Vetëm Postuar</option>
              <option value="ALL">Të gjitha</option>
              <option value="DRAFT">Vetëm Draft</option>
              <option value="CANCELLED">Vetëm Anuluar</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => { setDateFrom(`${thisYear}-01-01`); setDateTo(new Date().toISOString().slice(0,10)); setCustomerId(''); setUserId(''); setStatus('POSTED'); }}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              ↺ Reseto
            </button>
          </div>
        </div>
      </div>

      {/* ── Stat cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Të Ardhura Bruto" value={`${fmt(stats.revenue)} €`} sub={`${stats.count} fatura`} color="indigo" />
        <StatCard label="Nëntotali (pa TVSH)" value={`${fmt(stats.netTotal)} €`} color="emerald" />
        <StatCard label="TVSH e Mbledhur" value={`${fmt(stats.taxTotal)} €`} color="amber" />
        <StatCard label="Mesatarja / Faturë" value={`${fmt(stats.avg)} €`} color="slate" />
      </div>

      {/* ── Chart + Top customers ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <MonthlyChart invoices={filtered} />
        </div>
        <TopCustomers invoices={filtered} />
      </div>

      {/* ── Invoice table ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Faturat ({filtered.length})
          </span>
          <span className="text-xs text-slate-400">Totali: <strong className="text-slate-700">{fmt(stats.revenue)} €</strong></span>
        </div>
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">Nuk ka fatura për filtrat e zgjedhur.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-2.5">Nr. Dok.</th>
                  <th className="px-4 py-2.5">Data</th>
                  <th className="px-4 py-2.5">Blerësi</th>
                  <th className="px-4 py-2.5">Agjenti</th>
                  <th className="px-4 py-2.5 text-right">Neto</th>
                  <th className="px-4 py-2.5 text-right">TVSH</th>
                  <th className="px-4 py-2.5 text-right">Bruto</th>
                  <th className="px-4 py-2.5">Statusi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs font-medium text-slate-800">{inv.docNo ?? '—'}</td>
                    <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap text-xs">{fmtDate(inv.docDate ?? inv.createdAt)}</td>
                    <td className="px-4 py-2.5 text-slate-700 text-xs">{inv.customer?.name ?? <span className="text-slate-400 italic">Pa blerës</span>}</td>
                    <td className="px-4 py-2.5 text-slate-600 text-xs">{inv.createdBy?.fullName ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-xs text-slate-600">{fmt(Number(inv.subtotal ?? 0))}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-xs text-slate-500">{fmt(Number(inv.taxTotal ?? 0))}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-xs font-semibold text-slate-900">{fmt(Number(inv.grandTotal ?? 0))}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(inv.status)}`}>
                        {statusLabel(inv.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Grand total row */}
              <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                <tr>
                  <td colSpan={4} className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Totali ({filtered.length} fatura)
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-xs font-bold text-slate-700">{fmt(stats.netTotal)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-xs font-bold text-amber-700">{fmt(stats.taxTotal)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-sm font-bold text-indigo-700">{fmt(stats.revenue)} €</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
