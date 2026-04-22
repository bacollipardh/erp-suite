'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { formatDateOnly } from '@/lib/date';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { useSession } from '@/components/session-provider';
import { StatusBadge } from '@/components/status-badge';

type SalesReportResponse = {
  summary: {
    count: number;
    revenue: number;
    netTotal: number;
    taxTotal: number;
    avg: number;
  };
  monthly: { key: string; label: string; total: number }[];
  topCustomers: { name: string; total: number; count: number }[];
  topAgents: { name: string; total: number; count: number }[];
  recentInvoices: {
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
  }[];
};

type AgingReportResponse = {
  summary: {
    current: number;
    days1To30: number;
    days31To60: number;
    days61To90: number;
    days90Plus: number;
  };
  totalOutstanding: number;
  openCount: number;
  overdueCount: number;
  items: {
    id: string;
    docNo: string;
    docDate: string;
    dueDate: string;
    total: number;
    paid: number;
    daysPastDue: number;
    outstanding: number;
    dueState: string;
    party?: { id: string; name: string } | null;
  }[];
};

type PaymentActivityResponse = {
  summary: {
    count: number;
    visibleCount: number;
    visibleAmount: number;
    totalAmount: number;
    currentMonthAmount: number;
    currentMonthCount: number;
  };
  items: {
    id: string;
    documentId: string;
    docNo: string;
    docDate: string;
    dueDate?: string | null;
    settlementTotal: number;
    currentOutstandingAmount: number;
    amount: number;
    paidAt: string;
    referenceNo?: string | null;
    notes?: string | null;
    remainingAmount: number;
    paymentStatusAfter?: string | null;
    createdAt: string;
    user?: { id: string; fullName: string; email?: string | null } | null;
    party?: { id: string; name: string } | null;
  }[];
  total: number;
  pageCount: number;
  page: number;
  limit: number;
};

function fmt(value: number) {
  return value.toLocaleString('sq-AL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseApiError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Raporti deshtoi.';
}

function StatCard({
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

function MonthlyChart({ months }: { months: SalesReportResponse['monthly'] }) {
  const max = Math.max(...months.map((row) => row.total), 1);

  if (months.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Shitjet Mujore</h2>
        <p className="text-sm text-slate-400">Nuk ka te dhena per periudhen e zgjedhur.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-800 mb-3">Shitjet Mujore</h2>
      <div className="flex items-end gap-2 h-36">
        {months.map((month) => (
          <div key={month.key} className="flex-1 flex flex-col items-center gap-2">
            <div className="w-full h-24 flex items-end">
              <div
                className="w-full rounded-t bg-indigo-500"
                style={{ height: `${Math.max(6, Math.round((month.total / max) * 100))}%` }}
                title={`${month.label}: ${fmt(month.total)} EUR`}
              />
            </div>
            <span className="text-[10px] text-slate-400">{month.label}</span>
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
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-800 mb-3">{title}</h2>
      <div className="space-y-3">
        {rows.length === 0 ? <p className="text-sm text-slate-400">Nuk ka te dhena.</p> : null}
        {rows.map((row, index) => (
          <div key={`${row.name}-${index}`} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{row.name}</p>
              <p className="text-xs text-slate-400">{row.count} dokumente</p>
            </div>
            <p className="text-sm font-semibold text-slate-900">{fmt(row.total)} EUR</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgingCard({
  title,
  report,
}: {
  title: string;
  report: AgingReportResponse;
}) {
  const buckets = [
    { label: 'Aktuale', value: report.summary.current },
    { label: '1-30 dite', value: report.summary.days1To30 },
    { label: '31-60 dite', value: report.summary.days31To60 },
    { label: '61-90 dite', value: report.summary.days61To90 },
    { label: '90+ dite', value: report.summary.days90Plus },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        <div className="text-right">
          <span className="text-sm font-semibold text-slate-900">
            {fmt(report.totalOutstanding)} EUR
          </span>
          <p className="text-xs text-slate-400 mt-1">
            {report.openCount} dokumente - {report.overdueCount} me vonese
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {buckets.map((bucket) => (
          <div key={bucket.label} className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">{bucket.label}</p>
            <p className="text-sm font-semibold text-slate-900 mt-1">{fmt(bucket.value)} EUR</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgingTable({
  title,
  report,
}: {
  title: string;
  report: AgingReportResponse;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      </div>
      {report.items.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-400">Nuk ka dokumente te hapura.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5">Dokumenti</th>
                <th className="px-4 py-2.5">Subjekti</th>
                <th className="px-4 py-2.5">Data</th>
                <th className="px-4 py-2.5">Afati</th>
                <th className="px-4 py-2.5 text-right">Totali</th>
                <th className="px-4 py-2.5 text-right">Paguar</th>
                <th className="px-4 py-2.5 text-right">Mbetur</th>
                <th className="px-4 py-2.5">Afati Pageses</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {report.items.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-800">{row.docNo}</td>
                  <td className="px-4 py-2.5 text-slate-700">{row.party?.name ?? '-'}</td>
                  <td className="px-4 py-2.5 text-slate-600">{formatDateOnly(row.docDate)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{formatDateOnly(row.dueDate)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600">
                    {fmt(Number(row.total ?? 0))} EUR
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-600">
                    {fmt(Number(row.paid ?? 0))} EUR
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-slate-900">
                    {fmt(Number(row.outstanding ?? 0))} EUR
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge value={row.dueState} />
                      <span className="text-xs text-slate-500">
                        {row.dueState === 'NO_DUE_DATE'
                          ? 'Pa afat'
                          : row.daysPastDue > 0
                            ? `${row.daysPastDue} dite`
                            : 'Ne afat'}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PaymentActivityPanel({
  title,
  report,
  emptyText,
  documentBasePath,
  viewAllHref,
}: {
  title: string;
  report: PaymentActivityResponse;
  emptyText: string;
  documentBasePath: string;
  viewAllHref?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          <p className="text-xs text-slate-500 mt-1">
            {report.summary.visibleCount} rreshta ne pamje - {fmt(report.summary.visibleAmount)} EUR
            {' / '}
            gjithsej {fmt(report.summary.totalAmount)} EUR
          </p>
        </div>
        <div className="flex flex-col gap-2 lg:items-end">
          {viewAllHref ? (
            <Link
              href={viewAllHref}
              className="text-xs font-medium text-indigo-700 hover:text-indigo-900"
            >
              Shiko te gjitha
            </Link>
          ) : null}
          <div className="grid grid-cols-2 gap-2 text-right">
            <div className="rounded-lg bg-white px-3 py-2 border border-slate-200">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Kete muaj</p>
              <p className="text-sm font-semibold text-slate-900">
                {fmt(report.summary.currentMonthAmount)} EUR
              </p>
            </div>
            <div className="rounded-lg bg-white px-3 py-2 border border-slate-200">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">
                Gjithsej regjistrime
              </p>
              <p className="text-sm font-semibold text-slate-900">{report.summary.count}</p>
            </div>
          </div>
        </div>
      </div>

      {report.items.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-400">{emptyText}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5">Data Pageses</th>
                <th className="px-4 py-2.5">Dokumenti</th>
                <th className="px-4 py-2.5">Subjekti</th>
                <th className="px-4 py-2.5">Data / Afati</th>
                <th className="px-4 py-2.5 text-right">Shuma</th>
                <th className="px-4 py-2.5 text-right">Mbetur Pas Pageses</th>
                <th className="px-4 py-2.5">Statusi</th>
                <th className="px-4 py-2.5">Operatori</th>
                <th className="px-4 py-2.5">Referenca</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {report.items.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 text-slate-600">{formatDateOnly(row.paidAt)}</td>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`${documentBasePath}/${row.documentId}`}
                      className="font-mono text-xs text-indigo-700 hover:text-indigo-900"
                    >
                      {row.docNo}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{row.party?.name ?? '-'}</td>
                  <td className="px-4 py-2.5 text-slate-600">
                    <div className="space-y-1">
                      <p>Data: {formatDateOnly(row.docDate)}</p>
                      <p>Afati: {formatDateOnly(row.dueDate)}</p>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-slate-900">
                    {fmt(Number(row.amount ?? 0))} EUR
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-600">
                    {fmt(Number(row.remainingAmount ?? 0))} EUR
                  </td>
                  <td className="px-4 py-2.5">
                    {row.paymentStatusAfter ? <StatusBadge value={row.paymentStatusAfter} /> : '-'}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {row.user?.fullName ?? row.user?.email ?? '-'}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{row.referenceNo ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ReportsClient({
  customers,
  users,
}: {
  customers: any[];
  users: any[];
}) {
  const { user, loading: sessionLoading } = useSession();
  const canSales = hasPermission(user?.permissions, PERMISSIONS.reportsSales);
  const canReceivables = hasPermission(user?.permissions, PERMISSIONS.reportsReceivables);
  const canPayables = hasPermission(user?.permissions, PERMISSIONS.reportsPayables);

  const thisYear = new Date().getFullYear();
  const [dateFrom, setDateFrom] = useState(`${thisYear}-01-01`);
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [customerId, setCustomerId] = useState('');
  const [userId, setUserId] = useState('');
  const [statusFilter, setStatusFilter] = useState('POSTED');
  const [salesReport, setSalesReport] = useState<SalesReportResponse | null>(null);
  const [receivables, setReceivables] = useState<AgingReportResponse | null>(null);
  const [payables, setPayables] = useState<AgingReportResponse | null>(null);
  const [receiptsActivity, setReceiptsActivity] = useState<PaymentActivityResponse | null>(null);
  const [supplierPaymentsActivity, setSupplierPaymentsActivity] =
    useState<PaymentActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionLoading) return;

    let active = true;

    async function loadReports() {
      if (!canSales && !canReceivables && !canPayables) {
        if (active) {
          setLoading(false);
          setSalesReport(null);
          setReceivables(null);
          setPayables(null);
          setReceiptsActivity(null);
          setSupplierPaymentsActivity(null);
        }
        return;
      }

      setLoading(true);
      setError(null);

      const tasks = await Promise.allSettled([
        canSales
          ? api.query('reports/sales-summary', {
              dateFrom,
              dateTo,
              customerId,
              userId,
              status: statusFilter,
              limitRecent: 100,
            })
          : Promise.resolve(null),
        canReceivables
          ? api.query('reports/receivables-aging', { limit: 100 })
          : Promise.resolve(null),
        canPayables
          ? api.query('reports/payables-aging', { limit: 100 })
          : Promise.resolve(null),
        canReceivables
          ? api.query('reports/receipts-activity', { limit: 10 })
          : Promise.resolve(null),
        canPayables
          ? api.query('reports/supplier-payments-activity', { limit: 10 })
          : Promise.resolve(null),
      ]);

      if (!active) return;

      const [
        salesResult,
        receivableResult,
        payableResult,
        receiptsActivityResult,
        supplierPaymentsResult,
      ] = tasks;

      if (salesResult.status === 'fulfilled') {
        setSalesReport(salesResult.value as SalesReportResponse | null);
      } else if (canSales) {
        setError(parseApiError(salesResult.reason));
      }

      if (receivableResult.status === 'fulfilled') {
        setReceivables(receivableResult.value as AgingReportResponse | null);
      } else if (canReceivables) {
        setError(parseApiError(receivableResult.reason));
      }

      if (payableResult.status === 'fulfilled') {
        setPayables(payableResult.value as AgingReportResponse | null);
      } else if (canPayables) {
        setError(parseApiError(payableResult.reason));
      }

      if (receiptsActivityResult.status === 'fulfilled') {
        setReceiptsActivity(receiptsActivityResult.value as PaymentActivityResponse | null);
      } else if (canReceivables) {
        setError(parseApiError(receiptsActivityResult.reason));
      }

      if (supplierPaymentsResult.status === 'fulfilled') {
        setSupplierPaymentsActivity(
          supplierPaymentsResult.value as PaymentActivityResponse | null,
        );
      } else if (canPayables) {
        setError(parseApiError(supplierPaymentsResult.reason));
      }

      setLoading(false);
    }

    void loadReports();

    return () => {
      active = false;
    };
  }, [
    canPayables,
    canReceivables,
    canSales,
    customerId,
    dateFrom,
    dateTo,
    sessionLoading,
    statusFilter,
    userId,
  ]);

  const summary = salesReport?.summary ?? {
    count: 0,
    revenue: 0,
    netTotal: 0,
    taxTotal: 0,
    avg: 0,
  };

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

  if (!sessionLoading && !canSales && !canReceivables && !canPayables) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Nuk keni te drejta per raportet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {canSales ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Te gjithe klientet</option>
              {customers.map((customer: any) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Te gjithe agjentet</option>
              {users.map((entry: any) => (
                <option key={entry.id} value={entry.id}>
                  {entry.fullName}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="POSTED">Vetem Postuar</option>
              <option value="ALL">Te gjitha</option>
              <option value="DRAFT">Vetem Draft</option>
              <option value="CANCELLED">Vetem Anuluar</option>
              <option value="PARTIALLY_RETURNED">Pjeserisht te kthyera</option>
              <option value="FULLY_RETURNED">Plotesisht te kthyera</option>
            </select>
            <button
              type="button"
              onClick={() => {
                setDateFrom(`${thisYear}-01-01`);
                setDateTo(new Date().toISOString().slice(0, 10));
                setCustomerId('');
                setUserId('');
                setStatusFilter('POSTED');
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Reseto
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {canSales ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Te Ardhura Bruto"
              value={`${fmt(summary.revenue)} EUR`}
              sub={`${summary.count} fatura`}
            />
            <StatCard label="Nentotali" value={`${fmt(summary.netTotal)} EUR`} />
            <StatCard label="TVSH" value={`${fmt(summary.taxTotal)} EUR`} />
            <StatCard label="Mesatarja / Fature" value={`${fmt(summary.avg)} EUR`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <MonthlyChart months={salesReport?.monthly ?? []} />
            </div>
            <RankingCard title="Top Klientet" rows={salesReport?.topCustomers ?? []} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RankingCard title="Top Agjentet" rows={salesReport?.topAgents ?? []} />
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-800 mb-2">Gjendja e raportit</h2>
              <p className="text-sm text-slate-500">
                Raporti ngarkohet nga backend me filtra server-side dhe nuk terheq te gjithe
                dataset-in ne frontend.
              </p>
              <p className="text-xs text-slate-400 mt-2">
                {loading ? 'Duke rifreskuar te dhenat...' : 'Raporti eshte i perditesuar.'}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-800">Faturat e fundit</h2>
            </div>
            {loading ? (
              <div className="py-10 text-center text-sm text-slate-400">Duke ngarkuar raportin...</div>
            ) : (salesReport?.recentInvoices ?? []).length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">
                Nuk ka fatura per filtrat e zgjedhur.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
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
                    {(salesReport?.recentInvoices ?? []).map((invoice) => (
                      <tr key={invoice.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-800">
                          {invoice.docNo}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">
                          {formatDateOnly(invoice.docDate ?? invoice.createdAt)}
                        </td>
                        <td className="px-4 py-2.5 text-slate-700">{invoice.customer?.name ?? '-'}</td>
                        <td className="px-4 py-2.5 text-slate-600">
                          {invoice.createdBy?.fullName ?? '-'}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-600">
                          {fmt(Number(invoice.subtotal ?? 0))}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-600">
                          {fmt(Number(invoice.taxTotal ?? 0))}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-slate-900">
                          {fmt(Number(invoice.grandTotal ?? 0))}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">
                          {statusLabel[invoice.status] ?? invoice.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}

      {canReceivables && receivables ? (
        <>
          <AgingCard title="Receivables Aging" report={receivables} />
          <AgingTable title="Dokumentet e Hapura te Klienteve" report={receivables} />
          {receiptsActivity ? (
            <PaymentActivityPanel
              title="Arketimet e Fundit"
              report={receiptsActivity}
              emptyText="Nuk ka arketime te regjistruara ende."
              documentBasePath="/sales-invoices"
              viewAllHref="/arketime"
            />
          ) : null}
        </>
      ) : null}

      {canPayables && payables ? (
        <>
          <AgingCard title="Payables Aging" report={payables} />
          <AgingTable title="Detyrimet ndaj Furnitoreve" report={payables} />
          {supplierPaymentsActivity ? (
            <PaymentActivityPanel
              title="Pagesat e Fundit ndaj Furnitoreve"
              report={supplierPaymentsActivity}
              emptyText="Nuk ka pagesa te regjistruara ende."
              documentBasePath="/purchase-invoices"
              viewAllHref="/pagesat"
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
