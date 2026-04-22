'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { formatDateOnly } from '@/lib/date';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import {
  buildAgingCsv,
  buildAgingExportFilename,
  buildAgingMailtoHref,
  type AgingExportKind,
  triggerCsvDownload,
} from '@/lib/report-export';
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
  visibleCount: number;
  overdueCount: number;
  truncated: boolean;
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
    paymentStatus?: string | null;
    party?: { id: string; name: string } | null;
  }[];
};

type ExposureReportResponse = {
  summary: {
    partyCount: number;
    overduePartyCount: number;
    documentCount: number;
    totalOutstanding: number;
    overdueOutstanding: number;
    dueTodayOutstanding: number;
    currentOutstanding: number;
  };
  visibleCount: number;
  truncated: boolean;
  items: {
    party?: { id: string; name: string } | null;
    openCount: number;
    overdueCount: number;
    dueTodayCount: number;
    unpaidCount: number;
    partiallyPaidCount: number;
    totalOutstanding: number;
    overdueOutstanding: number;
    dueTodayOutstanding: number;
    currentOutstanding: number;
    maxDaysPastDue: number;
    oldestDueDate?: string | null;
    newestDocDate?: string | null;
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

const AGING_EXPORT_LIMIT = 500;

type PartyOption = {
  id: string;
  name: string;
};

type FinanceFilterState = {
  search: string;
  partyId: string;
  dueState: string;
  paymentStatus: string;
  minOutstanding: string;
  maxOutstanding: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
};

function createFinanceFilterState(overrides?: Partial<FinanceFilterState>): FinanceFilterState {
  return {
    search: '',
    partyId: '',
    dueState: 'ALL',
    paymentStatus: 'ALL',
    minOutstanding: '',
    maxOutstanding: '',
    sortBy: 'daysPastDue',
    sortOrder: 'desc',
    ...overrides,
  };
}

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
  actions,
}: {
  title: string;
  report: AgingReportResponse;
  actions?: import('react').ReactNode;
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
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          <div className="text-left lg:text-right">
            <span className="text-sm font-semibold text-slate-900">
              {fmt(report.totalOutstanding)} EUR
            </span>
            <p className="text-xs text-slate-400 mt-1">
              {report.openCount} dokumente - {report.overdueCount} me vonese
              {report.truncated ? ` - duke shfaqur ${report.visibleCount}` : ''}
            </p>
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
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

function AgingReportActions({
  kind,
  loadingKey,
  onAction,
}: {
  kind: AgingExportKind;
  loadingKey: string | null;
  onAction: (kind: AgingExportKind, action: 'csv' | 'email') => void;
}) {
  const csvKey = `${kind}-csv`;
  const emailKey = `${kind}-email`;
  const isBusy = Boolean(loadingKey);

  return (
    <>
      <button
        type="button"
        onClick={() => onAction(kind, 'csv')}
        disabled={isBusy}
        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loadingKey === csvKey ? 'Duke eksportuar...' : 'Export CSV'}
      </button>
      <button
        type="button"
        onClick={() => onAction(kind, 'email')}
        disabled={isBusy}
        className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loadingKey === emailKey ? 'Duke pergatitur...' : 'Email Summary'}
      </button>
    </>
  );
}

function FinanceFilterPanel({
  title,
  description,
  filters,
  onChange,
  onReset,
  parties,
  partyLabel,
}: {
  title: string;
  description: string;
  filters: FinanceFilterState;
  onChange: (patch: Partial<FinanceFilterState>) => void;
  onReset: () => void;
  parties: PartyOption[];
  partyLabel: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <input
          type="text"
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value })}
          placeholder="Kerko dokument ose subjekt..."
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={filters.partyId}
          onChange={(e) => onChange({ partyId: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Te gjithe {partyLabel.toLowerCase()}t</option>
          {parties.map((party) => (
            <option key={party.id} value={party.id}>
              {party.name}
            </option>
          ))}
        </select>
        <select
          value={filters.dueState}
          onChange={(e) => onChange({ dueState: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="ALL">Te gjitha afatet</option>
          <option value="OVERDUE">Vetem overdue</option>
          <option value="DUE_TODAY">Afati sot</option>
          <option value="CURRENT">Ne afat</option>
          <option value="NO_DUE_DATE">Pa afat</option>
        </select>
        <select
          value={filters.paymentStatus}
          onChange={(e) => onChange({ paymentStatus: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="ALL">Te gjitha pagesat e hapura</option>
          <option value="UNPAID">Vetem pa pagese</option>
          <option value="PARTIALLY_PAID">Vetem pjeserisht paguar</option>
        </select>
        <input
          type="number"
          min="0"
          step="0.01"
          value={filters.minOutstanding}
          onChange={(e) => onChange({ minOutstanding: e.target.value })}
          placeholder="Outstanding min"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          type="number"
          min="0"
          step="0.01"
          value={filters.maxOutstanding}
          onChange={(e) => onChange({ maxOutstanding: e.target.value })}
          placeholder="Outstanding max"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={filters.sortBy}
          onChange={(e) => onChange({ sortBy: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="daysPastDue">Ditet e voneses</option>
          <option value="outstanding">Outstanding</option>
          <option value="dueDate">Afati</option>
          <option value="docDate">Data e dokumentit</option>
          <option value="party">Subjekti</option>
          <option value="docNo">Nr. dokumentit</option>
          <option value="paymentStatus">Statusi i pageses</option>
        </select>
        <div className="flex gap-2">
          <select
            value={filters.sortOrder}
            onChange={(e) => onChange({ sortOrder: e.target.value as 'asc' | 'desc' })}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="desc">Zbrites</option>
            <option value="asc">Rrites</option>
          </select>
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Reseto
          </button>
        </div>
      </div>
    </div>
  );
}

function ExposureSummary({
  title,
  report,
}: {
  title: string;
  report: ExposureReportResponse;
}) {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      <StatCard
        label={`${title} Total`}
        value={`${fmt(report.summary.totalOutstanding)} EUR`}
        sub={`${report.summary.partyCount} subjekte`}
      />
      <StatCard
        label="Overdue Exposure"
        value={`${fmt(report.summary.overdueOutstanding)} EUR`}
        sub={`${report.summary.overduePartyCount} subjekte overdue`}
      />
      <StatCard
        label="Due Today"
        value={`${fmt(report.summary.dueTodayOutstanding)} EUR`}
        sub={`${report.summary.documentCount} dokumente ne scope`}
      />
      <StatCard
        label="Current Exposure"
        value={`${fmt(report.summary.currentOutstanding)} EUR`}
        sub={report.truncated ? `Duke shfaqur ${report.visibleCount}` : 'Pamje e plote'}
      />
    </div>
  );
}

function ExposureTable({
  title,
  report,
  activityBasePath,
  partyQueryKey,
}: {
  title: string;
  report: ExposureReportResponse;
  activityBasePath: string;
  partyQueryKey: 'customerId' | 'supplierId';
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        <p className="mt-1 text-xs text-slate-500">
          Ekspozimi sipas subjektit per dokumentet e hapura dhe overdue.
        </p>
      </div>
      {report.items.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-400">Nuk ka ekspozim per filtrat aktuale.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5">Subjekti</th>
                <th className="px-4 py-2.5 text-right">Dokumente</th>
                <th className="px-4 py-2.5 text-right">Outstanding</th>
                <th className="px-4 py-2.5 text-right">Overdue</th>
                <th className="px-4 py-2.5 text-right">Due Today</th>
                <th className="px-4 py-2.5 text-right">Max Dite</th>
                <th className="px-4 py-2.5">Afati me i vjeter</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {report.items.map((row, index) => {
                const href = row.party?.id
                  ? `${activityBasePath}?${partyQueryKey}=${encodeURIComponent(row.party.id)}`
                  : activityBasePath;

                return (
                  <tr key={`${row.party?.id ?? 'none'}-${index}`} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5">
                      <div className="min-w-[180px]">
                        <Link
                          href={href}
                          className="font-medium text-indigo-700 hover:text-indigo-900"
                        >
                          {row.party?.name ?? 'Pa subjekt'}
                        </Link>
                        <p className="text-xs text-slate-400 mt-1">
                          Unpaid: {row.unpaidCount} · Partial: {row.partiallyPaidCount}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-600">
                      {row.openCount} / {row.overdueCount}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-900">
                      {fmt(Number(row.totalOutstanding ?? 0))} EUR
                    </td>
                    <td className="px-4 py-2.5 text-right text-red-700">
                      {fmt(Number(row.overdueOutstanding ?? 0))} EUR
                    </td>
                    <td className="px-4 py-2.5 text-right text-amber-700">
                      {fmt(Number(row.dueTodayOutstanding ?? 0))} EUR
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-600">
                      {row.maxDaysPastDue > 0 ? `${row.maxDaysPastDue} dite` : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {formatDateOnly(row.oldestDueDate)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AgingTable({
  title,
  report,
  documentBasePath,
}: {
  title: string;
  report: AgingReportResponse;
  documentBasePath: string;
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
                <th className="px-4 py-2.5">Pagesa</th>
                <th className="px-4 py-2.5 text-right">Totali</th>
                <th className="px-4 py-2.5 text-right">Paguar</th>
                <th className="px-4 py-2.5 text-right">Mbetur</th>
                <th className="px-4 py-2.5">Afati Pageses</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {report.items.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`${documentBasePath}/${row.id}`}
                      className="font-mono text-xs text-indigo-700 hover:text-indigo-900"
                    >
                      {row.docNo}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{row.party?.name ?? '-'}</td>
                  <td className="px-4 py-2.5 text-slate-600">{formatDateOnly(row.docDate)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{formatDateOnly(row.dueDate)}</td>
                  <td className="px-4 py-2.5">
                    {row.paymentStatus ? <StatusBadge value={row.paymentStatus} /> : '-'}
                  </td>
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
  suppliers,
  users,
  includeSales = true,
  includeReceivables = true,
  includePayables = true,
}: {
  customers: PartyOption[];
  suppliers: PartyOption[];
  users: any[];
  includeSales?: boolean;
  includeReceivables?: boolean;
  includePayables?: boolean;
}) {
  const { user, loading: sessionLoading } = useSession();
  const canSales = includeSales && hasPermission(user?.permissions, PERMISSIONS.reportsSales);
  const canReceivables =
    includeReceivables && hasPermission(user?.permissions, PERMISSIONS.reportsReceivables);
  const canPayables = includePayables && hasPermission(user?.permissions, PERMISSIONS.reportsPayables);

  const thisYear = new Date().getFullYear();
  const [dateFrom, setDateFrom] = useState(`${thisYear}-01-01`);
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [customerId, setCustomerId] = useState('');
  const [userId, setUserId] = useState('');
  const [statusFilter, setStatusFilter] = useState('POSTED');
  const [receivablesFilters, setReceivablesFilters] = useState<FinanceFilterState>(
    createFinanceFilterState({ sortBy: 'daysPastDue', sortOrder: 'desc' }),
  );
  const [payablesFilters, setPayablesFilters] = useState<FinanceFilterState>(
    createFinanceFilterState({ sortBy: 'daysPastDue', sortOrder: 'desc' }),
  );
  const [salesReport, setSalesReport] = useState<SalesReportResponse | null>(null);
  const [receivables, setReceivables] = useState<AgingReportResponse | null>(null);
  const [payables, setPayables] = useState<AgingReportResponse | null>(null);
  const [receivablesExposure, setReceivablesExposure] = useState<ExposureReportResponse | null>(
    null,
  );
  const [payablesExposure, setPayablesExposure] = useState<ExposureReportResponse | null>(null);
  const [receiptsActivity, setReceiptsActivity] = useState<PaymentActivityResponse | null>(null);
  const [supplierPaymentsActivity, setSupplierPaymentsActivity] =
    useState<PaymentActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoadingKey, setActionLoadingKey] = useState<string | null>(null);

  function buildAgingQuery(
    filters: FinanceFilterState,
    partyQueryKey: 'customerId' | 'supplierId',
  ) {
    return {
      limit: 100,
      search: filters.search || undefined,
      [partyQueryKey]: filters.partyId || undefined,
      dueState: filters.dueState !== 'ALL' ? filters.dueState : undefined,
      paymentStatus: filters.paymentStatus !== 'ALL' ? filters.paymentStatus : undefined,
      minOutstanding: filters.minOutstanding ? Number(filters.minOutstanding) : undefined,
      maxOutstanding: filters.maxOutstanding ? Number(filters.maxOutstanding) : undefined,
      sortBy: filters.sortBy || undefined,
      sortOrder: filters.sortOrder,
    };
  }

  function patchReceivablesFilters(patch: Partial<FinanceFilterState>) {
    setReceivablesFilters((current) => ({
      ...current,
      ...patch,
    }));
  }

  function patchPayablesFilters(patch: Partial<FinanceFilterState>) {
    setPayablesFilters((current) => ({
      ...current,
      ...patch,
    }));
  }

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
          setReceivablesExposure(null);
          setPayablesExposure(null);
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
          ? api.query(
              'reports/receivables-aging',
              buildAgingQuery(receivablesFilters, 'customerId'),
            )
          : Promise.resolve(null),
        canReceivables
          ? api.query(
              'reports/receivables-exposure',
              buildAgingQuery({ ...receivablesFilters, sortBy: 'totalOutstanding' }, 'customerId'),
            )
          : Promise.resolve(null),
        canPayables
          ? api.query('reports/payables-aging', buildAgingQuery(payablesFilters, 'supplierId'))
          : Promise.resolve(null),
        canPayables
          ? api.query(
              'reports/payables-exposure',
              buildAgingQuery({ ...payablesFilters, sortBy: 'totalOutstanding' }, 'supplierId'),
            )
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
        receivableExposureResult,
        payableResult,
        payableExposureResult,
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

      if (receivableExposureResult.status === 'fulfilled') {
        setReceivablesExposure(receivableExposureResult.value as ExposureReportResponse | null);
      } else if (canReceivables) {
        setError(parseApiError(receivableExposureResult.reason));
      }

      if (payableResult.status === 'fulfilled') {
        setPayables(payableResult.value as AgingReportResponse | null);
      } else if (canPayables) {
        setError(parseApiError(payableResult.reason));
      }

      if (payableExposureResult.status === 'fulfilled') {
        setPayablesExposure(payableExposureResult.value as ExposureReportResponse | null);
      } else if (canPayables) {
        setError(parseApiError(payableExposureResult.reason));
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
    payablesFilters,
    receivablesFilters,
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

  async function fetchAgingExportReport(kind: AgingExportKind) {
    const endpoint =
      kind === 'receivables' ? 'reports/receivables-aging' : 'reports/payables-aging';
    const query =
      kind === 'receivables'
        ? buildAgingQuery(
            {
              ...receivablesFilters,
            },
            'customerId',
          )
        : buildAgingQuery(
            {
              ...payablesFilters,
            },
            'supplierId',
          );

    return (await api.query(endpoint, {
      ...query,
      limit: AGING_EXPORT_LIMIT,
    })) as AgingReportResponse;
  }

  async function handleAgingAction(kind: AgingExportKind, action: 'csv' | 'email') {
    const actionKey = `${kind}-${action}`;
    setActionError(null);
    setActionLoadingKey(actionKey);

    try {
      const report = await fetchAgingExportReport(kind);

      if (action === 'csv') {
        triggerCsvDownload(buildAgingExportFilename(kind), buildAgingCsv(kind, report));
      } else {
        window.location.href = buildAgingMailtoHref(kind, report);
      }
    } catch (actionFailure) {
      setActionError(parseApiError(actionFailure));
    } finally {
      setActionLoadingKey(null);
    }
  }

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

      {actionError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {actionError}
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
          <FinanceFilterPanel
            title="Filtrat e Receivables"
            description="Filtro dokumentet e hapura sipas klientit, afatit, payment status dhe outstanding amount."
            filters={receivablesFilters}
            onChange={patchReceivablesFilters}
            onReset={() =>
              setReceivablesFilters(
                createFinanceFilterState({ sortBy: 'daysPastDue', sortOrder: 'desc' }),
              )
            }
            parties={customers}
            partyLabel="Klienti"
          />
          <AgingCard
            title="Receivables Aging"
            report={receivables}
            actions={
              <AgingReportActions
                kind="receivables"
                loadingKey={actionLoadingKey}
                onAction={handleAgingAction}
              />
            }
          />
          {receivablesExposure ? (
            <>
              <ExposureSummary title="Debtor Exposure" report={receivablesExposure} />
              <ExposureTable
                title="Debtor Exposure"
                report={receivablesExposure}
                activityBasePath="/arketime"
                partyQueryKey="customerId"
              />
            </>
          ) : null}
          <AgingTable
            title="Dokumentet e Hapura te Klienteve"
            report={receivables}
            documentBasePath="/sales-invoices"
          />
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
          <FinanceFilterPanel
            title="Filtrat e Payables"
            description="Filtro detyrimet sipas furnitorit, afatit, payment status dhe outstanding amount."
            filters={payablesFilters}
            onChange={patchPayablesFilters}
            onReset={() =>
              setPayablesFilters(
                createFinanceFilterState({ sortBy: 'daysPastDue', sortOrder: 'desc' }),
              )
            }
            parties={suppliers}
            partyLabel="Furnitori"
          />
          <AgingCard
            title="Payables Aging"
            report={payables}
            actions={
              <AgingReportActions
                kind="payables"
                loadingKey={actionLoadingKey}
                onAction={handleAgingAction}
              />
            }
          />
          {payablesExposure ? (
            <>
              <ExposureSummary title="Creditor Exposure" report={payablesExposure} />
              <ExposureTable
                title="Creditor Exposure"
                report={payablesExposure}
                activityBasePath="/pagesat"
                partyQueryKey="supplierId"
              />
            </>
          ) : null}
          <AgingTable
            title="Detyrimet ndaj Furnitoreve"
            report={payables}
            documentBasePath="/purchase-invoices"
          />
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
