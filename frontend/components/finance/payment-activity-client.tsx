'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { DataTable } from '@/components/data-table';
import { StatsCard } from '@/components/stats-card';
import { StatusBadge } from '@/components/status-badge';
import { api } from '@/lib/api';
import { formatDateOnly, formatDateTime } from '@/lib/date';
import {
  buildPaymentActivityCsv,
  buildPaymentActivityExportFilename,
  buildPaymentActivityMailtoHref,
  type PaymentActivityExportKind,
  triggerCsvDownload,
} from '@/lib/report-export';

type PartyOption = {
  id: string;
  name: string;
};

type PaymentActivityResponse = {
  summary: {
    count: number;
    visibleCount: number;
    visibleAmount: number;
    visibleEnteredAmount: number;
    visibleUnappliedAmount: number;
    totalAmount: number;
    totalEnteredAmount: number;
    totalUnappliedAmount: number;
    currentMonthAmount: number;
    currentMonthEnteredAmount: number;
    currentMonthUnappliedAmount: number;
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
    enteredAmount: number;
    appliedAmount: number;
    unappliedAmount: number;
    allowUnapplied: boolean;
    paidAt: string;
    referenceNo?: string | null;
    notes?: string | null;
    remainingAmount: number;
    paymentStatusAfter?: string | null;
    createdAt: string;
    user?: { id: string; fullName: string; email?: string | null } | null;
    party?: { id: string; name: string } | null;
  }[];
  page: number;
  limit: number;
  total: number;
  pageCount: number;
};

const PAYMENT_ACTIVITY_EXPORT_LIMIT = 500;

function formatMoney(value: number | string | null | undefined) {
  return Number(value ?? 0).toLocaleString('sq-AL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function PaymentActivityClient({
  endpoint,
  parties,
  partyLabel,
  partyQueryKey,
  documentBasePath,
  exportKind,
  title,
  description,
  emptyText,
  initialFilters,
}: {
  endpoint: string;
  parties: PartyOption[];
  partyLabel: string;
  partyQueryKey: 'customerId' | 'supplierId';
  documentBasePath: string;
  exportKind: PaymentActivityExportKind;
  title: string;
  description?: string;
  emptyText: string;
  initialFilters?: {
    search?: string;
    partyId?: string;
    dateFrom?: string;
    dateTo?: string;
    statusAfter?: string;
    minAmount?: string;
    maxAmount?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
  };
}) {
  const [search, setSearch] = useState(initialFilters?.search ?? '');
  const [partyId, setPartyId] = useState(initialFilters?.partyId ?? '');
  const [dateFrom, setDateFrom] = useState(initialFilters?.dateFrom ?? '');
  const [dateTo, setDateTo] = useState(initialFilters?.dateTo ?? '');
  const [statusAfter, setStatusAfter] = useState(initialFilters?.statusAfter ?? '');
  const [minAmount, setMinAmount] = useState(initialFilters?.minAmount ?? '');
  const [maxAmount, setMaxAmount] = useState(initialFilters?.maxAmount ?? '');
  const [sortBy, setSortBy] = useState(initialFilters?.sortBy ?? 'paidAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialFilters?.sortOrder ?? 'desc');
  const [page, setPage] = useState(initialFilters?.page ?? 1);
  const [payload, setPayload] = useState<PaymentActivityResponse>({
    summary: {
      count: 0,
      visibleCount: 0,
      visibleAmount: 0,
      visibleEnteredAmount: 0,
      visibleUnappliedAmount: 0,
      totalAmount: 0,
      totalEnteredAmount: 0,
      totalUnappliedAmount: 0,
      currentMonthAmount: 0,
      currentMonthEnteredAmount: 0,
      currentMonthUnappliedAmount: 0,
      currentMonthCount: 0,
    },
    items: [],
    page: 1,
    limit: 20,
    total: 0,
    pageCount: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoadingKey, setActionLoadingKey] = useState<string | null>(null);

  useEffect(() => {
    setSearch(initialFilters?.search ?? '');
    setPartyId(initialFilters?.partyId ?? '');
    setDateFrom(initialFilters?.dateFrom ?? '');
    setDateTo(initialFilters?.dateTo ?? '');
    setStatusAfter(initialFilters?.statusAfter ?? '');
    setMinAmount(initialFilters?.minAmount ?? '');
    setMaxAmount(initialFilters?.maxAmount ?? '');
    setSortBy(initialFilters?.sortBy ?? 'paidAt');
    setSortOrder(initialFilters?.sortOrder ?? 'desc');
    setPage(initialFilters?.page ?? 1);
  }, [
    initialFilters?.dateFrom,
    initialFilters?.dateTo,
    initialFilters?.maxAmount,
    initialFilters?.minAmount,
    initialFilters?.page,
    initialFilters?.partyId,
    initialFilters?.search,
    initialFilters?.sortBy,
    initialFilters?.sortOrder,
    initialFilters?.statusAfter,
  ]);

  useEffect(() => {
    let active = true;

    async function loadActivity() {
      setLoading(true);
      setError(null);

      try {
        const result = await api.listPage(endpoint, {
          page,
          limit: 20,
          search,
          dateFrom,
          dateTo,
          [partyQueryKey]: partyId,
          statusAfter,
          minAmount: minAmount ? Number(minAmount) : undefined,
          maxAmount: maxAmount ? Number(maxAmount) : undefined,
          sortBy,
          sortOrder,
        });

        if (active) {
          setPayload(result as PaymentActivityResponse);
        }
      } catch (err: any) {
        if (active) {
          setError(err?.message ?? 'Ngarkimi i aktivitetit financiar deshtoi.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadActivity();

    return () => {
      active = false;
    };
  }, [dateFrom, dateTo, endpoint, maxAmount, minAmount, page, partyId, partyQueryKey, search, sortBy, sortOrder, statusAfter]);

  const pageSummary = useMemo(() => {
    const remainingInPage = payload.items.reduce(
      (sum, row) => sum + Number(row.currentOutstandingAmount ?? 0),
      0,
    );

    return {
      remainingInPage,
      pageAmount: payload.items.reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
      pageEnteredAmount: payload.items.reduce(
        (sum, row) => sum + Number(row.enteredAmount ?? row.amount ?? 0),
        0,
      ),
      pageUnappliedAmount: payload.items.reduce(
        (sum, row) => sum + Number(row.unappliedAmount ?? 0),
        0,
      ),
    };
  }, [payload.items]);

  async function fetchExportPayload() {
    return (await api.listPage(endpoint, {
      page: 1,
      limit: PAYMENT_ACTIVITY_EXPORT_LIMIT,
      search,
      dateFrom,
      dateTo,
      [partyQueryKey]: partyId,
      statusAfter,
      minAmount: minAmount ? Number(minAmount) : undefined,
      maxAmount: maxAmount ? Number(maxAmount) : undefined,
      sortBy,
      sortOrder,
    })) as PaymentActivityResponse;
  }

  async function handleExportAction(action: 'csv' | 'email') {
    setActionError(null);
    setActionLoadingKey(action);

    try {
      const exportPayload = await fetchExportPayload();

      if (action === 'csv') {
        triggerCsvDownload(
          buildPaymentActivityExportFilename(exportKind),
          buildPaymentActivityCsv(exportKind, exportPayload),
        );
      } else {
        window.location.href = buildPaymentActivityMailtoHref(exportKind, exportPayload);
      }
    } catch (err: any) {
      setActionError(err?.message ?? 'Eksporti i aktivitetit financiar deshtoi.');
    } finally {
      setActionLoadingKey(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
            <p className="mt-2 text-xs text-slate-400">
              Export-i dhe email summary respektojne filtrat aktuale deri ne{' '}
              {PAYMENT_ACTIVITY_EXPORT_LIMIT} rreshta.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleExportAction('csv')}
              disabled={loading || Boolean(actionLoadingKey)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {actionLoadingKey === 'csv' ? 'Duke eksportuar...' : 'Export CSV'}
            </button>
            <button
              type="button"
              onClick={() => void handleExportAction('email')}
              disabled={loading || Boolean(actionLoadingKey)}
              className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {actionLoadingKey === 'email' ? 'Duke pergatitur...' : 'Email Summary'}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <input
            type="text"
            placeholder={`Kerko dokument, ${partyLabel.toLowerCase()}, reference ose operator...`}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={partyId}
            onChange={(e) => {
              setPartyId(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Te gjithe</option>
            {parties.map((party) => (
              <option key={party.id} value={party.id}>
                {party.name}
              </option>
            ))}
          </select>
          <select
            value={statusAfter}
            onChange={(e) => {
              setStatusAfter(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Te gjitha statuset</option>
            <option value="UNPAID">UNPAID</option>
            <option value="PARTIALLY_PAID">PARTIALLY_PAID</option>
            <option value="PAID">PAID</option>
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Shuma minimale"
            value={minAmount}
            onChange={(e) => {
              setMinAmount(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Shuma maksimale"
            value={maxAmount}
            onChange={(e) => {
              setMaxAmount(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="paidAt">Data e pageses</option>
            <option value="amount">Shuma</option>
            <option value="remainingAmount">Mbetur pas pageses</option>
            <option value="currentOutstandingAmount">Mbetja aktuale</option>
            <option value="docDate">Data e dokumentit</option>
            <option value="dueDate">Afati i pageses</option>
            <option value="party">Subjekti</option>
            <option value="docNo">Nr. dokumentit</option>
          </select>
          <select
            value={sortOrder}
            onChange={(e) => {
              setSortOrder(e.target.value as 'asc' | 'desc');
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="desc">Zbrites</option>
            <option value="asc">Rrites</option>
          </select>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setPartyId('');
              setDateFrom('');
              setDateTo('');
              setStatusAfter('');
              setMinAmount('');
              setMaxAmount('');
              setSortBy('paidAt');
              setSortOrder('desc');
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Reseto filtrat
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-6 gap-3">
        <StatsCard
          title="Gjithsej regjistrime"
          value={payload.summary.count}
          subtitle={`${payload.pageCount} faqe`}
        />
        <StatsCard
          title="Aplikuar e filtruar"
          value={`${formatMoney(payload.summary.totalAmount)} EUR`}
          subtitle={`${payload.summary.currentMonthCount} kete muaj`}
        />
        <StatsCard
          title="E hyre ne faqe"
          value={`${formatMoney(pageSummary.pageEnteredAmount)} EUR`}
          subtitle={`Aplikuar ${formatMoney(pageSummary.pageAmount)} EUR`}
        />
        <StatsCard
          title="Unapplied e filtruar"
          value={`${formatMoney(payload.summary.totalUnappliedAmount)} EUR`}
          subtitle={`Ne faqe ${formatMoney(pageSummary.pageUnappliedAmount)} EUR`}
        />
        <StatsCard
          title="Aplikuar ne faqe"
          value={`${formatMoney(pageSummary.pageAmount)} EUR`}
          subtitle={`${payload.summary.visibleCount} rreshta ne pamje`}
        />
        <StatsCard
          title="Mbetja aktuale ne faqe"
          value={`${formatMoney(pageSummary.remainingInPage)} EUR`}
          subtitle="Sipas dokumenteve te afishuara"
        />
      </div>

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

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-400">
          Duke ngarkuar aktivitetin financiar...
        </div>
      ) : payload.items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-400">
          {emptyText}
        </div>
      ) : (
        <DataTable
          data={payload.items}
          columns={[
            {
              key: 'paidAt',
              title: 'Pagesa',
              render: (row: PaymentActivityResponse['items'][number]) => (
                <div className="min-w-[140px]">
                  <p className="font-medium text-slate-800">{formatDateOnly(row.paidAt)}</p>
                  <p className="text-xs text-slate-400">{formatDateTime(row.createdAt)}</p>
                </div>
              ),
            },
            {
              key: 'document',
              title: 'Dokumenti',
              render: (row: PaymentActivityResponse['items'][number]) => (
                <div className="min-w-[170px]">
                  <Link
                    href={`${documentBasePath}/${row.documentId}`}
                    className="font-mono text-xs text-indigo-700 hover:text-indigo-900"
                  >
                    {row.docNo}
                  </Link>
                  <p className="text-xs text-slate-400">
                    {formatDateOnly(row.docDate)} / {formatDateOnly(row.dueDate)}
                  </p>
                </div>
              ),
            },
            {
              key: 'party',
              title: partyLabel,
              render: (row: PaymentActivityResponse['items'][number]) => (
                <div className="min-w-[190px]">
                  <p className="font-medium text-slate-800">{row.party?.name ?? '-'}</p>
                </div>
              ),
            },
            {
              key: 'amount',
              title: 'Shuma',
              render: (row: PaymentActivityResponse['items'][number]) => (
                <div className="min-w-[150px]">
                  <p className="font-semibold text-slate-900">
                    {formatMoney(row.appliedAmount ?? row.amount)} EUR
                  </p>
                  <p className="text-xs text-slate-400">
                    Hyrja: {formatMoney(row.enteredAmount ?? row.amount)} EUR
                  </p>
                  {Number(row.unappliedAmount ?? 0) > 0 ? (
                    <p className="text-xs text-amber-700">
                      Unapplied: {formatMoney(row.unappliedAmount)} EUR
                    </p>
                  ) : null}
                </div>
              ),
            },
            {
              key: 'remaining',
              title: 'Mbetur Pas',
              render: (row: PaymentActivityResponse['items'][number]) => (
                <span className="text-slate-700">{formatMoney(row.remainingAmount)} EUR</span>
              ),
            },
            {
              key: 'currentOutstandingAmount',
              title: 'Mbetja Aktuale',
              render: (row: PaymentActivityResponse['items'][number]) => (
                <span className="text-slate-700">
                  {formatMoney(row.currentOutstandingAmount)} EUR
                </span>
              ),
            },
            {
              key: 'status',
              title: 'Statusi',
              render: (row: PaymentActivityResponse['items'][number]) =>
                row.paymentStatusAfter ? <StatusBadge value={row.paymentStatusAfter} /> : '-',
            },
            {
              key: 'operator',
              title: 'Operatori',
              render: (row: PaymentActivityResponse['items'][number]) => (
                <div className="min-w-[150px]">
                  <p className="text-slate-700">{row.user?.fullName ?? '-'}</p>
                  <p className="text-xs text-slate-400">{row.user?.email ?? ''}</p>
                </div>
              ),
            },
            {
              key: 'referenceNo',
              title: 'Reference / Shenime',
              render: (row: PaymentActivityResponse['items'][number]) => (
                <div className="min-w-[180px]">
                  <p className="text-slate-700">{row.referenceNo ?? '-'}</p>
                  <p className="text-xs text-slate-400">{row.notes ?? ''}</p>
                </div>
              ),
            },
          ]}
        />
      )}

      <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
        <span className="text-slate-500">
          Totali: <strong className="text-slate-900">{payload.total}</strong> regjistrime
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
