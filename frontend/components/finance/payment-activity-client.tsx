'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { DataTable } from '@/components/data-table';
import { StatsCard } from '@/components/stats-card';
import { StatusBadge } from '@/components/status-badge';
import { api } from '@/lib/api';
import { formatDateOnly, formatDateTime } from '@/lib/date';

type PartyOption = {
  id: string;
  name: string;
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
  page: number;
  limit: number;
  total: number;
  pageCount: number;
};

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
  title,
  description,
  emptyText,
}: {
  endpoint: string;
  parties: PartyOption[];
  partyLabel: string;
  partyQueryKey: 'customerId' | 'supplierId';
  documentBasePath: string;
  title: string;
  description?: string;
  emptyText: string;
}) {
  const [search, setSearch] = useState('');
  const [partyId, setPartyId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusAfter, setStatusAfter] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [sortBy, setSortBy] = useState('paidAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState<PaymentActivityResponse>({
    summary: {
      count: 0,
      visibleCount: 0,
      visibleAmount: 0,
      totalAmount: 0,
      currentMonthAmount: 0,
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
    };
  }, [payload.items]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
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

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatsCard
          title="Gjithsej regjistrime"
          value={payload.summary.count}
          subtitle={`${payload.pageCount} faqe`}
        />
        <StatsCard
          title="Shuma e filtruar"
          value={`${formatMoney(payload.summary.totalAmount)} EUR`}
          subtitle={`${payload.summary.currentMonthCount} kete muaj`}
        />
        <StatsCard
          title="Shuma ne faqe"
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
                <span className="font-semibold text-slate-900">
                  {formatMoney(row.amount)} EUR
                </span>
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
