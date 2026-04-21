'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

function fmt(n: number) {
  return n.toLocaleString('sq-AL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('sq-AL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

type ReportInvoice = {
  id: string;
  docNo: string;
  docDate: string;
  createdAt: string;
  status: string;
  grandTotal: number | string;
  subtotal: number | string;
  taxTotal: number | string;
  customer?: { id: string; name: string } | null;
  createdBy?: { id: string; fullName: string } | null;
};

type SalesReportResponse = {
  summary: {
    count: number;
    revenue: number;
    netTotal: number;
    taxTotal: number;
    avg: number;
  };
  monthly: { key: string; label: string; total: number }[];
  topCustomers: { customerId?: string | null; name: string; total: number; count: number }[];
  topAgents: { userId?: string | null; name: string; total: number; count: number }[];
  recentInvoices: ReportInvoice[];
};

function StatCard({
  label,
  value,
  sub,
  color = 'indigo',
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  const colors: Record<string, string> = {
    indigo: 'border-indigo-200 bg-indigo-50',
    emerald: 'border-emerald-200 bg-emerald-50',
    amber: 'border-amber-200 bg-amber-50',
    slate: 'border-slate-200 bg-slate-50',
  };
  const textColors: Record<string, string> = {
    indigo: 'text-indigo-700',
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
    slate: 'text-slate-700',
  };

  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 tabular-nums ${textColors[color]}`}>{value}</p>
      {sub ? <p className="text-xs text-slate-400 mt-0.5">{sub}</p> : null}
    </div>
  );
}

function MonthlyChart({ months }: { months: SalesReportResponse['monthly'] }) {
  const max = Math.max(...months.map((row) => row.total), 1);

  if (months.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Shitjet Mujore (EUR)</h2>
        <p className="text-sm text-slate-400">Nuk ka te dhena per grafikun.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-700 mb-4">Shitjet Mujore (EUR)</h2>
      <div className="flex items-end gap-1.5 h-32">
        {months.map((row) => (
          <div key={row.key} className="flex-1 flex flex-col items-center gap-1 group">
            <div className="relative w-full flex items-end justify-center" style={{ height: '96px' }}>
              <div
                className="w-full bg-indigo-500 group-hover:bg-indigo-600 rounded-t transition-all duration-200"
                style={{ height: `${Math.max(Math.round((row.total / max) * 100), 2)}%` }}
                title={`${row.label}: ${fmt(row.total)} EUR`}
              />
            </div>
            <span className="text-[9px] text-slate-400 whitespace-nowrap">{row.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RankingCard({
  title,
  rows,
}: {
  title: string;
  rows: { name: string; total: number; count: number }[];
}) {
  const maxTotal = Math.max(...rows.map((row) => row.total), 1);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-700 mb-3">{title}</h2>
      <div className="space-y-2.5">
        {rows.map((row, index) => (
          <div key={`${row.name}-${index}`} className="flex items-center gap-2">
            <span className="w-5 text-xs font-bold text-slate-400 shrink-0 text-right">{index + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs font-medium text-slate-700 truncate">{row.name}</span>
                <span className="text-xs font-bold text-indigo-700 tabular-nums ml-2 shrink-0">
                  {fmt(row.total)} EUR
                </span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-400 rounded-full"
                  style={{ width: `${Math.round((row.total / maxTotal) * 100)}%` }}
                />
              </div>
            </div>
            <span className="text-xs text-slate-400 shrink-0 w-12 text-right">{row.count} fat.</span>
          </div>
        ))}
        {rows.length === 0 ? <p className="text-sm text-slate-400">Nuk ka te dhena.</p> : null}
      </div>
    </div>
  );
}

export function SalesReportClient({
  customers,
  users,
}: {
  customers: any[];
  users: any[];
}) {
  const thisYear = new Date().getFullYear();
  const [dateFrom, setDateFrom] = useState(`${thisYear}-01-01`);
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [customerId, setCustomerId] = useState('');
  const [userId, setUserId] = useState('');
  const [statusFilter, setStatus] = useState('POSTED');
  const [report, setReport] = useState<SalesReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadReport() {
      setLoading(true);
      setError(null);
      try {
        const result = await api.query('reports/sales-summary', {
          dateFrom,
          dateTo,
          customerId,
          userId,
          status: statusFilter,
          limitRecent: 100,
        });
        if (active) {
          setReport(result);
        }
      } catch (err: any) {
        if (active) {
          setError(typeof err.message === 'string' ? err.message : 'Raporti deshtoi');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadReport();
    return () => {
      active = false;
    };
  }, [dateFrom, dateTo, customerId, userId, statusFilter]);

  const stats = report?.summary ?? {
    count: 0,
    revenue: 0,
    netTotal: 0,
    taxTotal: 0,
    avg: 0,
  };

  const invoices = report?.recentInvoices ?? [];
  const topCustomers = report?.topCustomers ?? [];
  const topAgents = report?.topAgents ?? [];
  const monthly = report?.monthly ?? [];

  const statusBadge = useMemo(
    () =>
      ({
        POSTED: 'bg-emerald-100 text-emerald-700',
        DRAFT: 'bg-slate-100 text-slate-500',
        CANCELLED: 'bg-red-100 text-red-500',
        PARTIALLY_RETURNED: 'bg-amber-100 text-amber-700',
        FULLY_RETURNED: 'bg-indigo-100 text-indigo-700',
      }) as Record<string, string>,
    [],
  );

  const statusLabel = useMemo(
    () =>
      ({
        POSTED: 'Postuar',
        DRAFT: 'Draft',
        CANCELLED: 'Anuluar',
        PARTIALLY_RETURNED: 'Pjeserisht e kthyer',
        FULLY_RETURNED: 'Plotesisht e kthyer',
      }) as Record<string, string>,
    [],
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Nga data</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Deri me</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Klienti</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-colors"
            >
              <option value="">- Te gjithe -</option>
              {customers.map((customer: any) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Agjenti</label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-colors"
            >
              <option value="">- Te gjithe -</option>
              {users.map((user: any) => (
                <option key={user.id} value={user.id}>
                  {user.fullName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Statusi</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-colors"
            >
              <option value="POSTED">Vetem Postuar</option>
              <option value="ALL">Te gjitha</option>
              <option value="DRAFT">Vetem Draft</option>
              <option value="CANCELLED">Vetem Anuluar</option>
              <option value="PARTIALLY_RETURNED">Pjeserisht te kthyera</option>
              <option value="FULLY_RETURNED">Plotesisht te kthyera</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setDateFrom(`${thisYear}-01-01`);
                setDateTo(new Date().toISOString().slice(0, 10));
                setCustomerId('');
                setUserId('');
                setStatus('POSTED');
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Reseto
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Te Ardhura Bruto"
          value={`${fmt(stats.revenue)} EUR`}
          sub={`${stats.count} fatura`}
          color="indigo"
        />
        <StatCard label="Nentotali" value={`${fmt(stats.netTotal)} EUR`} color="emerald" />
        <StatCard label="TVSH" value={`${fmt(stats.taxTotal)} EUR`} color="amber" />
        <StatCard label="Mesatarja / Fature" value={`${fmt(stats.avg)} EUR`} color="slate" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <MonthlyChart months={monthly} />
        </div>
        <RankingCard title="Top Klientet" rows={topCustomers} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RankingCard title="Top Agjentet" rows={topAgents} />
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Gjendja e raportit</h2>
          <div className="space-y-2 text-sm text-slate-600">
            <p>Raporti ngarkohet nga backend me filtra server-side.</p>
            <p>Lista poshte tregon vetem faturat e fundit qe perputhen me filtrat.</p>
            <p>{loading ? 'Duke rifreskuar te dhenat...' : 'Raporti eshte i perditesuar.'}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Faturat e fundit ({invoices.length})
          </span>
          <span className="text-xs text-slate-400">
            Totali i filtruar: <strong className="text-slate-700">{fmt(stats.revenue)} EUR</strong>
          </span>
        </div>
        {loading ? (
          <div className="py-12 text-center text-sm text-slate-400">Duke ngarkuar raportin...</div>
        ) : invoices.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">
            Nuk ka fatura per filtrat e zgjedhur.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-2.5">Nr. Dok.</th>
                  <th className="px-4 py-2.5">Data</th>
                  <th className="px-4 py-2.5">Klienti</th>
                  <th className="px-4 py-2.5">Agjenti</th>
                  <th className="px-4 py-2.5 text-right">Neto</th>
                  <th className="px-4 py-2.5 text-right">TVSH</th>
                  <th className="px-4 py-2.5 text-right">Bruto</th>
                  <th className="px-4 py-2.5">Statusi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs font-medium text-slate-800">
                      {invoice.docNo ?? '-'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap text-xs">
                      {fmtDate(invoice.docDate ?? invoice.createdAt)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700 text-xs">
                      {invoice.customer?.name ?? <span className="text-slate-400 italic">Pa klient</span>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 text-xs">
                      {invoice.createdBy?.fullName ?? '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-xs text-slate-600">
                      {fmt(Number(invoice.subtotal ?? 0))}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-xs text-slate-500">
                      {fmt(Number(invoice.taxTotal ?? 0))}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-xs font-semibold text-slate-900">
                      {fmt(Number(invoice.grandTotal ?? 0))}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          statusBadge[invoice.status] ?? 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {statusLabel[invoice.status] ?? invoice.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
