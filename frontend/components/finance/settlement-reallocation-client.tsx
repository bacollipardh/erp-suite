'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { StatsCard } from '@/components/stats-card';
import { StatusBadge } from '@/components/status-badge';
import { api } from '@/lib/api';
import { formatDateOnly, toDateInputValue } from '@/lib/date';

type PartyOption = {
  id: string;
  name: string;
};

type AllocationItem = {
  id: string;
  amount: number;
  allocatedAt: string;
  notes?: string | null;
  amountPaidBefore: number;
  amountPaidAfter: number;
  outstandingBefore: number;
  outstandingAfter: number;
  paymentStatusBefore?: string | null;
  paymentStatusAfter?: string | null;
  createdAt: string;
  createdBy?: { id: string; fullName: string; email?: string | null } | null;
  targetDocument?: {
    id: string;
    docNo: string;
    docDate: string;
    dueDate?: string | null;
    type: string;
  } | null;
};

type SettlementItem = {
  id: string;
  entryType: string;
  status: string;
  paidAt: string;
  enteredAmount: number;
  sourceAppliedAmount: number;
  unappliedAmount: number;
  allocatedAmount: number;
  remainingAmount: number;
  referenceNo?: string | null;
  notes?: string | null;
  sourceAuditLogId?: string | null;
  createdAt: string;
  updatedAt: string;
  party?: { id: string; name: string } | null;
  sourceDocument?: {
    id: string;
    docNo: string;
    docDate: string;
    dueDate?: string | null;
    type: string;
  } | null;
  createdBy?: { id: string; fullName: string; email?: string | null } | null;
  allocationCount: number;
  allocations: AllocationItem[];
};

type SettlementListResponse = {
  summary: {
    count: number;
    visibleCount: number;
    openCount: number;
    partiallyAllocatedCount: number;
    fullyAllocatedCount: number;
    totalEnteredAmount: number;
    totalUnappliedAmount: number;
    totalAllocatedAmount: number;
    totalRemainingAmount: number;
  };
  items: SettlementItem[];
  page: number;
  limit: number;
  total: number;
  pageCount: number;
};

type TargetDocument = {
  id: string;
  docNo: string;
  docDate: string;
  dueDate?: string | null;
  total: number;
  paid: number;
  outstanding: number;
  paymentStatus?: string | null;
  dueState?: string | null;
  daysPastDue?: number;
};

type SettlementTargetsResponse = {
  settlement: SettlementItem;
  targets: TargetDocument[];
};

function formatMoney(value?: number | string | null) {
  return Number(value ?? 0).toLocaleString('sq-AL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function roundMoney(value: number) {
  return Math.round((Number(value ?? 0) + Number.EPSILON) * 100) / 100;
}

function parseApiError(error: unknown) {
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message);
      if (typeof parsed.message === 'string') return parsed.message;
    } catch {}
    return error.message;
  }

  return 'Ndodhi nje gabim gjate veprimit.';
}

function duePriority(dueState?: string | null) {
  switch (dueState) {
    case 'OVERDUE':
      return 0;
    case 'DUE_TODAY':
      return 1;
    case 'CURRENT':
      return 2;
    case 'NO_DUE_DATE':
      return 3;
    default:
      return 4;
  }
}

export function SettlementReallocationClient({
  mode,
  parties,
  endpointBase,
  partyLabel,
  documentBasePath,
  activityHref,
  emptyText,
  initialSearch = '',
  initialPartyId = '',
  initialStatus = 'OPEN',
}: {
  mode: 'receipt' | 'payment';
  parties: PartyOption[];
  endpointBase: 'finance-settlements/receipts' | 'finance-settlements/payments';
  partyLabel: string;
  documentBasePath: string;
  activityHref: string;
  emptyText: string;
  initialSearch?: string;
  initialPartyId?: string;
  initialStatus?: 'ALL' | 'OPEN' | 'PARTIALLY_ALLOCATED' | 'FULLY_ALLOCATED';
}) {
  const [search, setSearch] = useState(initialSearch);
  const [partyId, setPartyId] = useState(initialPartyId);
  const [status, setStatus] = useState<'ALL' | 'OPEN' | 'PARTIALLY_ALLOCATED' | 'FULLY_ALLOCATED'>(
    initialStatus,
  );
  const [sortBy, setSortBy] = useState<'paidAt' | 'remainingAmount' | 'allocatedAmount' | 'party' | 'sourceDocNo' | 'createdAt'>('paidAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState<SettlementListResponse>({
    summary: {
      count: 0,
      visibleCount: 0,
      openCount: 0,
      partiallyAllocatedCount: 0,
      fullyAllocatedCount: 0,
      totalEnteredAmount: 0,
      totalUnappliedAmount: 0,
      totalAllocatedAmount: 0,
      totalRemainingAmount: 0,
    },
    items: [],
    page: 1,
    limit: 20,
    total: 0,
    pageCount: 1,
  });
  const [selectedId, setSelectedId] = useState<string>('');
  const [details, setDetails] = useState<SettlementTargetsResponse | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [targetDocumentId, setTargetDocumentId] = useState('');
  const [amount, setAmount] = useState('');
  const [allocatedAt, setAllocatedAt] = useState(toDateInputValue(new Date()));
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const labels =
    mode === 'receipt'
      ? {
          title: 'Rialokimi i arketimeve',
          action: 'Apliko arketimin',
          emptyTargets: 'Nuk ka fatura te hapura te ketij klienti per rialokim.',
        }
      : {
          title: 'Rialokimi i pagesave',
          action: 'Apliko pagesen',
          emptyTargets: 'Nuk ka fatura te hapura te ketij furnitori per rialokim.',
        };

  async function loadList() {
    setLoadingList(true);
    setError(null);

    try {
      const result = (await api.listPage(endpointBase, {
        page,
        limit: 20,
        search,
        [mode === 'receipt' ? 'customerId' : 'supplierId']: partyId,
        status,
        sortBy,
        sortOrder,
      })) as SettlementListResponse;

      setPayload(result);
      if (result.items.length === 0) {
        setSelectedId('');
        setDetails(null);
        return;
      }

      setSelectedId((current) =>
        current && result.items.some((item) => item.id === current) ? current : result.items[0].id,
      );
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoadingList(false);
    }
  }

  async function loadDetails(id: string) {
    if (!id) {
      setDetails(null);
      return;
    }

    setLoadingDetails(true);
    setActionError(null);

    try {
      const result = (await api.query(`${endpointBase}/${id}/targets`)) as SettlementTargetsResponse;
      setDetails(result);
    } catch (err) {
      setActionError(parseApiError(err));
    } finally {
      setLoadingDetails(false);
    }
  }

  useEffect(() => {
    void loadList();
  }, [endpointBase, mode, page, partyId, search, sortBy, sortOrder, status]);

  useEffect(() => {
    if (!selectedId) {
      setDetails(null);
      return;
    }

    void loadDetails(selectedId);
  }, [endpointBase, selectedId]);

  const selectedTarget = useMemo(
    () => details?.targets.find((item) => item.id === targetDocumentId) ?? null,
    [details?.targets, targetDocumentId],
  );

  useEffect(() => {
    if (!details) {
      setTargetDocumentId('');
      setAmount('');
      return;
    }

    if (details.targets.length === 0) {
      setTargetDocumentId('');
      setAmount('');
      return;
    }

    const activeTarget =
      details.targets.find((item) => item.id === targetDocumentId) ?? details.targets[0];
    setTargetDocumentId(activeTarget.id);

    const suggestedAmount = roundMoney(
      Math.min(
        Number(details.settlement.remainingAmount ?? 0),
        Number(activeTarget.outstanding ?? 0),
      ),
    );
    setAmount(suggestedAmount > 0 ? suggestedAmount.toFixed(2) : '');
  }, [details, targetDocumentId]);

  async function handleAllocate(event: FormEvent) {
    event.preventDefault();
    if (!selectedId || !details || !selectedTarget) return;

    setSubmitting(true);
    setActionError(null);
    setMessage(null);

    const numericAmount = roundMoney(Number(amount));
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setSubmitting(false);
      setActionError('Shkruaj nje shume valide per rialokim.');
      return;
    }

    if (numericAmount > Number(details.settlement.remainingAmount ?? 0)) {
      setSubmitting(false);
      setActionError('Shuma kalon balancen e mbetur ne advance.');
      return;
    }

    if (numericAmount > Number(selectedTarget.outstanding ?? 0)) {
      setSubmitting(false);
      setActionError('Shuma kalon mbetjen e hapur ne dokumentin target.');
      return;
    }

    try {
      const result = (await api.post(`${endpointBase}/${selectedId}/apply`, {
        targetDocumentId,
        amount: numericAmount,
        allocatedAt,
        notes: notes || undefined,
      })) as { settlement: SettlementItem };

      setMessage(
        `${labels.action} me sukses. ${formatMoney(numericAmount)} EUR u aplikuan te dokumenti i zgjedhur.`,
      );
      setNotes('');
      setDetails((current) =>
        current ? { ...current, settlement: result.settlement, targets: current.targets } : current,
      );
      await loadList();
      await loadDetails(selectedId);
    } catch (err) {
      setActionError(parseApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatsCard
          title="Advance te hapura"
          value={payload.summary.openCount}
          subtitle={`${payload.summary.partiallyAllocatedCount} pjeserisht te aplikuara`}
        />
        <StatsCard
          title="Balanca e mbetur"
          value={`${formatMoney(payload.summary.totalRemainingAmount)} EUR`}
          subtitle={`${payload.summary.count} zera sipas filtrit`}
        />
        <StatsCard
          title="Totali i rialokuar"
          value={`${formatMoney(payload.summary.totalAllocatedAmount)} EUR`}
          subtitle={`${payload.summary.fullyAllocatedCount} te mbyllura`}
        />
        <StatsCard
          title="Totali unapplied"
          value={`${formatMoney(payload.summary.totalUnappliedAmount)} EUR`}
          subtitle={`${formatMoney(payload.summary.totalEnteredAmount)} EUR te hyra fillimisht`}
        />
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
      {actionError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {actionError}
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{labels.title}</h2>
            <p className="mt-1 text-sm text-slate-500">
              Zgjidh nje balance `unapplied`, pastaj aplikoje te nje dokument tjeter te te njejtit subjekt.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={activityHref}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Kthehu te aktiviteti
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <input
            type="text"
            placeholder={`Kerko ${partyLabel.toLowerCase()}, dokument ose reference...`}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={partyId}
            onChange={(event) => {
              setPartyId(event.target.value);
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
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as typeof status);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="OPEN">OPEN</option>
            <option value="PARTIALLY_ALLOCATED">PARTIALLY_ALLOCATED</option>
            <option value="FULLY_ALLOCATED">FULLY_ALLOCATED</option>
            <option value="ALL">Te gjitha</option>
          </select>
          <select
            value={sortBy}
            onChange={(event) => {
              setSortBy(event.target.value as typeof sortBy);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="paidAt">Data e hyrjes</option>
            <option value="remainingAmount">Balanca e mbetur</option>
            <option value="allocatedAmount">E rialokuar</option>
            <option value="party">Subjekti</option>
            <option value="sourceDocNo">Dokumenti burim</option>
            <option value="createdAt">Krijuar me</option>
          </select>
          <div className="flex gap-2">
            <select
              value={sortOrder}
              onChange={(event) => {
                setSortOrder(event.target.value as 'asc' | 'desc');
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
                setStatus('OPEN');
                setSortBy('paidAt');
                setSortOrder('desc');
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Balancat unapplied</h3>
              <p className="mt-1 text-xs text-slate-500">
                Burimi dhe gjendja aktuale e secilit advance te hapur ose te rialokuar.
              </p>
            </div>
            <span className="text-xs text-slate-400">
              Totali: {payload.total} zera
            </span>
          </div>

          {loadingList ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
              Duke ngarkuar balancat...
            </div>
          ) : payload.items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
              {emptyText}
            </div>
          ) : (
            <div className="space-y-3">
              {payload.items.map((item) => {
                const active = item.id === selectedId;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full rounded-xl border p-4 text-left transition-all ${active ? 'border-indigo-400 bg-indigo-50/60 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <p className="font-mono text-xs text-slate-500">
                          {item.sourceDocument?.docNo ?? 'Pa dokument burim'}
                        </p>
                        <p className="text-sm font-semibold text-slate-900">
                          {item.party?.name ?? '-'}
                        </p>
                        <p className="text-xs text-slate-500">
                          Hyrja: {formatDateOnly(item.paidAt)} | Krijuar: {formatDateOnly(item.createdAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Mbetur</p>
                        <p className="text-lg font-bold text-slate-900">
                          {formatMoney(item.remainingAmount)} EUR
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <StatusBadge value={item.status} />
                      <span className="text-xs text-slate-500">
                        Unapplied: {formatMoney(item.unappliedAmount)} EUR
                      </span>
                      <span className="text-xs text-slate-500">
                        Rialokuar: {formatMoney(item.allocatedAmount)} EUR
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <span className="text-slate-500">
              Faqja {payload.page} / {payload.pageCount}
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

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
          {!selectedId || !details ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
              Zgjidh nje balance nga lista per te vazhduar me rialokimin.
            </div>
          ) : loadingDetails ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
              Duke ngarkuar dokumentet target...
            </div>
          ) : (
            <>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Detajet e advance-it</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Ky eshte burimi i teprices qe mund te aplikohet ne dokumente te tjera te te njejtit subjekt.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Dokumenti burim</p>
                  {details.settlement.sourceDocument ? (
                    <Link
                      href={`${documentBasePath}/${details.settlement.sourceDocument.id}`}
                      className="mt-1 inline-block font-mono text-sm font-semibold text-indigo-700 hover:text-indigo-900"
                    >
                      {details.settlement.sourceDocument.docNo}
                    </Link>
                  ) : (
                    <p className="mt-1 font-semibold text-slate-900">-</p>
                  )}
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">{partyLabel}</p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {details.settlement.party?.name ?? '-'}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Unapplied</p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {formatMoney(details.settlement.unappliedAmount)} EUR
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Mbetur per rialokim</p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {formatMoney(details.settlement.remainingAmount)} EUR
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Rialokuar deri tani</p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {formatMoney(details.settlement.allocatedAmount)} EUR
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Statusi</p>
                  <div className="mt-2">
                    <StatusBadge value={details.settlement.status} />
                  </div>
                </div>
              </div>

              <form onSubmit={handleAllocate} className="space-y-3 rounded-xl border border-slate-200 p-4">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Aplikoje te nje dokument tjeter</h4>
                  <p className="mt-1 text-xs text-slate-500">
                    Zgjidh dokumentin target dhe cakto shumen qe do te kalosh nga kjo balance.
                  </p>
                </div>

                {details.targets.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                    {labels.emptyTargets}
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      {details.targets.map((target) => {
                        const active = target.id === targetDocumentId;
                        return (
                          <button
                            key={target.id}
                            type="button"
                            onClick={() => setTargetDocumentId(target.id)}
                            className={`w-full rounded-xl border p-3 text-left transition-all ${active ? 'border-emerald-400 bg-emerald-50/60 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-mono text-xs text-slate-500">{target.docNo}</p>
                                <p className="mt-1 text-sm font-semibold text-slate-900">
                                  Data: {formatDateOnly(target.docDate)} | Afati: {formatDateOnly(target.dueDate)}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-slate-500">Mbetur</p>
                                <p className="text-sm font-semibold text-slate-900">
                                  {formatMoney(target.outstanding)} EUR
                                </p>
                              </div>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {target.paymentStatus ? <StatusBadge value={target.paymentStatus} /> : null}
                              {target.dueState ? <StatusBadge value={target.dueState} /> : null}
                              {Number(target.daysPastDue ?? 0) > 0 ? (
                                <span className="text-xs text-red-600">
                                  {target.daysPastDue} dite ne vonese
                                </span>
                              ) : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <label className="block space-y-1">
                        <span className="text-sm font-medium text-slate-700">Shuma</span>
                        <input
                          type="number"
                          min={0.01}
                          max={
                            selectedTarget
                              ? Math.min(
                                  Number(selectedTarget.outstanding ?? 0),
                                  Number(details.settlement.remainingAmount ?? 0),
                                )
                              : undefined
                          }
                          step="0.01"
                          value={amount}
                          onChange={(event) => setAmount(event.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-sm font-medium text-slate-700">Data e aplikimit</span>
                        <input
                          type="date"
                          value={allocatedAt}
                          onChange={(event) => setAllocatedAt(event.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-sm font-medium text-slate-700">Shenime</span>
                        <input
                          type="text"
                          value={notes}
                          onChange={(event) => setNotes(event.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </label>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                      <p className="font-medium text-slate-800">Preview i rialokimit</p>
                      <div className="mt-2 grid grid-cols-1 gap-2 text-slate-600 sm:grid-cols-3">
                        <p>Advance i mbetur: {formatMoney(details.settlement.remainingAmount)} EUR</p>
                        <p>Target outstanding: {formatMoney(selectedTarget?.outstanding ?? 0)} EUR</p>
                        <p>Per aplikim: {formatMoney(amount)} EUR</p>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={submitting || !selectedTarget}
                        className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        {submitting ? 'Duke aplikuar...' : labels.action}
                      </button>
                    </div>
                  </>
                )}
              </form>

              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                  <h4 className="text-sm font-semibold text-slate-900">Historia e rialokimeve</h4>
                </div>
                {details.settlement.allocations.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-400">
                    Ende nuk ka rialokime per kete advance.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <th className="px-4 py-2.5">Data</th>
                          <th className="px-4 py-2.5">Dokumenti target</th>
                          <th className="px-4 py-2.5">Shuma</th>
                          <th className="px-4 py-2.5">Para / Pas</th>
                          <th className="px-4 py-2.5">Operatori</th>
                          <th className="px-4 py-2.5">Shenime</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {details.settlement.allocations.map((allocation) => (
                          <tr key={allocation.id} className="hover:bg-slate-50/60">
                            <td className="px-4 py-2.5 text-slate-600">
                              {formatDateOnly(allocation.allocatedAt)}
                            </td>
                            <td className="px-4 py-2.5">
                              {allocation.targetDocument ? (
                                <Link
                                  href={`${documentBasePath}/${allocation.targetDocument.id}`}
                                  className="font-mono text-xs text-indigo-700 hover:text-indigo-900"
                                >
                                  {allocation.targetDocument.docNo}
                                </Link>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className="px-4 py-2.5 font-semibold text-slate-900">
                              {formatMoney(allocation.amount)} EUR
                            </td>
                            <td className="px-4 py-2.5 text-slate-600">
                              <div className="space-y-1">
                                <p>{formatMoney(allocation.outstandingBefore)} EUR</p>
                                <p className="text-xs text-slate-400">
                                  Pas: {formatMoney(allocation.outstandingAfter)} EUR
                                </p>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-slate-600">
                              {allocation.createdBy?.fullName ?? allocation.createdBy?.email ?? '-'}
                            </td>
                            <td className="px-4 py-2.5 text-slate-600">
                              {allocation.notes ?? '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
