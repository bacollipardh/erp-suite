'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { StatsCard } from '@/components/stats-card';
import { StatusBadge } from '@/components/status-badge';
import { api } from '@/lib/api';
import { formatDateOnly } from '@/lib/date';

type FinanceAccountOption = {
  id: string;
  code: string;
  name: string;
  accountType: 'CASH' | 'BANK';
  currentBalance: number;
  currencyCode?: string | null;
};

type StatementMatch = {
  id: string;
  amount: number;
  notes?: string | null;
  createdAt: string;
  createdBy?: { id: string; fullName: string; email?: string | null } | null;
  transaction?: {
    id: string;
    transactionType: string;
    amount: number;
    transactionDate: string;
    referenceNo?: string | null;
    counterpartyName?: string | null;
    sourceDocumentType?: string | null;
    sourceDocumentId?: string | null;
    sourceDocumentNo?: string | null;
    notes?: string | null;
  } | null;
};

type StatementLine = {
  id: string;
  direction: 'IN' | 'OUT';
  status: 'UNMATCHED' | 'PARTIALLY_MATCHED' | 'MATCHED';
  statementDate: string;
  valueDate?: string | null;
  amount: number;
  matchedAmount: number;
  remainingAmount: number;
  statementBalance?: number | null;
  referenceNo?: string | null;
  externalId?: string | null;
  counterpartyName?: string | null;
  description?: string | null;
  notes?: string | null;
  createdAt: string;
  account?: {
    id: string;
    code: string;
    name: string;
    accountType: 'CASH' | 'BANK';
    currentBalance: number;
    currencyCode?: string | null;
  } | null;
  matches: StatementMatch[];
  matchCount: number;
};

type CandidateTransaction = {
  id: string;
  transactionType: string;
  transactionDate: string;
  amount: number;
  matchedAmount: number;
  availableAmount: number;
  referenceNo?: string | null;
  counterpartyName?: string | null;
  sourceDocumentType?: string | null;
  sourceDocumentId?: string | null;
  sourceDocumentNo?: string | null;
  notes?: string | null;
  balanceAfter: number;
  score: number;
};

type StatementLineListResponse = {
  summary: {
    lineCount: number;
    accountCount: number;
    unmatchedCount: number;
    partiallyMatchedCount: number;
    matchedCount: number;
    totalIn: number;
    totalOut: number;
    totalMatched: number;
    totalUnmatched: number;
  };
  items: StatementLine[];
  page: number;
  limit: number;
  total: number;
  pageCount: number;
};

type StatementWorkspace = {
  statementLine: StatementLine;
  candidates: CandidateTransaction[];
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

function resolveDocumentHref(transaction?: {
  sourceDocumentType?: string | null;
  sourceDocumentId?: string | null;
} | null) {
  if (!transaction?.sourceDocumentId || !transaction.sourceDocumentType) return null;
  if (transaction.sourceDocumentType === 'sales-invoices') {
    return `/sales-invoices/${transaction.sourceDocumentId}`;
  }
  if (transaction.sourceDocumentType === 'purchase-invoices') {
    return `/purchase-invoices/${transaction.sourceDocumentId}`;
  }
  return null;
}

function emptyPayload(): StatementLineListResponse {
  return {
    summary: {
      lineCount: 0,
      accountCount: 0,
      unmatchedCount: 0,
      partiallyMatchedCount: 0,
      matchedCount: 0,
      totalIn: 0,
      totalOut: 0,
      totalMatched: 0,
      totalUnmatched: 0,
    },
    items: [],
    page: 1,
    limit: 20,
    total: 0,
    pageCount: 1,
  };
}

export function BankReconciliationClient({
  bankAccounts,
  canManage,
}: {
  bankAccounts: FinanceAccountOption[];
  canManage: boolean;
}) {
  const [accountId, setAccountId] = useState('');
  const [status, setStatus] = useState<'ALL' | 'UNMATCHED' | 'PARTIALLY_MATCHED' | 'MATCHED'>('UNMATCHED');
  const [direction, setDirection] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'statementDate' | 'amount' | 'status' | 'account'>('statementDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState<StatementLineListResponse>(emptyPayload);
  const [selectedId, setSelectedId] = useState('');
  const [workspace, setWorkspace] = useState<StatementWorkspace | null>(null);
  const [candidateAmounts, setCandidateAmounts] = useState<Record<string, string>>({});
  const [matchNotes, setMatchNotes] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [busyCandidateId, setBusyCandidateId] = useState<string | null>(null);
  const [busyMatchId, setBusyMatchId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadList() {
    setLoadingList(true);
    setError(null);

    try {
      const result = (await api.listPage('finance-reconciliation/statement-lines', {
        page,
        limit: 20,
        financeAccountId: accountId,
        status: status === 'ALL' ? undefined : status,
        direction: direction === 'ALL' ? undefined : direction,
        search,
        sortBy,
        sortOrder,
      })) as StatementLineListResponse;

      setPayload(result);
      if (result.items.length === 0) {
        setSelectedId('');
        setWorkspace(null);
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

  async function loadWorkspace(id: string) {
    if (!id) {
      setWorkspace(null);
      return;
    }

    setLoadingDetails(true);
    setActionError(null);

    try {
      const result = (await api.query(`finance-reconciliation/statement-lines/${id}/workspace`)) as StatementWorkspace;
      setWorkspace(result);
    } catch (err) {
      setActionError(parseApiError(err));
    } finally {
      setLoadingDetails(false);
    }
  }

  useEffect(() => {
    void loadList();
  }, [accountId, direction, page, search, sortBy, sortOrder, status]);

  useEffect(() => {
    if (!selectedId) {
      setWorkspace(null);
      return;
    }

    void loadWorkspace(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (!workspace) {
      setCandidateAmounts({});
      setMatchNotes('');
      return;
    }

    const next: Record<string, string> = {};
    workspace.candidates.forEach((candidate) => {
      const suggested = roundMoney(
        Math.min(
          Number(workspace.statementLine.remainingAmount ?? 0),
          Number(candidate.availableAmount ?? 0),
        ),
      );
      next[candidate.id] = suggested > 0 ? suggested.toFixed(2) : '';
    });
    setCandidateAmounts(next);
    setMatchNotes('');
  }, [workspace]);

  const selectedLine = workspace?.statementLine ?? payload.items.find((item) => item.id === selectedId) ?? null;

  const accountOptions = useMemo(
    () => [
      { id: '', label: 'Te gjitha llogarite' },
      ...bankAccounts.map((account) => ({
        id: account.id,
        label: `${account.code} - ${account.name}`,
      })),
    ],
    [bankAccounts],
  );

  async function handleMatch(candidate: CandidateTransaction) {
    if (!selectedLine) return;

    setBusyCandidateId(candidate.id);
    setActionError(null);
    setMessage(null);

    const numericAmount = roundMoney(Number(candidateAmounts[candidate.id]));
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setBusyCandidateId(null);
      setActionError('Shkruaj nje shume valide per match.');
      return;
    }

    if (numericAmount > Number(selectedLine.remainingAmount ?? 0)) {
      setBusyCandidateId(null);
      setActionError('Shuma kalon pjesen e pambuluar te statement-it.');
      return;
    }

    if (numericAmount > Number(candidate.availableAmount ?? 0)) {
      setBusyCandidateId(null);
      setActionError('Shuma kalon pjesen e lire te transaksionit ne ledger.');
      return;
    }

    try {
      const result = (await api.post(`finance-reconciliation/statement-lines/${selectedLine.id}/matches`, {
        financeAccountTransactionId: candidate.id,
        amount: numericAmount,
        notes: matchNotes || undefined,
      })) as StatementWorkspace;

      setWorkspace(result);
      setMessage(`${formatMoney(numericAmount)} EUR u pajtuan me transaksionin e ledger-it.`);
      await loadList();
    } catch (err) {
      setActionError(parseApiError(err));
    } finally {
      setBusyCandidateId(null);
    }
  }

  async function handleRemoveMatch(match: StatementMatch) {
    if (!selectedLine) return;

    const approved = window.confirm('A je i sigurt qe deshiron ta heqesh kete match?');
    if (!approved) return;

    setBusyMatchId(match.id);
    setActionError(null);
    setMessage(null);

    try {
      const result = (await api.delete(
        `finance-reconciliation/statement-lines/${selectedLine.id}/matches/${match.id}`,
      )) as StatementWorkspace;

      setWorkspace(result);
      setMessage('Match-i u largua dhe statement-i u rillogarit.');
      await loadList();
    } catch (err) {
      setActionError(parseApiError(err));
    } finally {
      setBusyMatchId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        <StatsCard
          title="Pa Match"
          value={payload.summary.unmatchedCount}
          subtitle={`${payload.summary.partiallyMatchedCount} pjeserisht`}
        />
        <StatsCard
          title="Te Pajtura"
          value={payload.summary.matchedCount}
          subtitle={`${payload.summary.lineCount} zera ne filter`}
        />
        <StatsCard
          title="Hyrje Banke"
          value={`${formatMoney(payload.summary.totalIn)} EUR`}
          subtitle={`${payload.summary.accountCount} llogari`}
        />
        <StatsCard
          title="Dalje Banke"
          value={`${formatMoney(payload.summary.totalOut)} EUR`}
          subtitle="Sipas filtrit aktual"
        />
        <StatsCard
          title="E Pambuluar"
          value={`${formatMoney(payload.summary.totalUnmatched)} EUR`}
          subtitle={`${formatMoney(payload.summary.totalMatched)} EUR te pajtuara`}
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
            <h2 className="text-base font-semibold text-slate-900">Pajtimi bankar</h2>
            <p className="mt-1 text-sm text-slate-500">
              Ketu statement-i i bankes kontrollohet kunder ledger-it te arketimit, pageses dhe transaksioneve manuale.
            </p>
          </div>
          {canManage ? (
            <Link
              href="/financa/pajtimi-bankar/new"
              className="inline-flex rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Levizje bankare e re
            </Link>
          ) : null}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
          <input
            type="text"
            placeholder="Kerko reference, pale, pershkrim..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm xl:col-span-2"
          />
          <select
            value={accountId}
            onChange={(event) => {
              setAccountId(event.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {accountOptions.map((option) => (
              <option key={option.id || 'all'} value={option.id}>
                {option.label}
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
            <option value="UNMATCHED">Pa Match</option>
            <option value="PARTIALLY_MATCHED">Pjeserisht</option>
            <option value="MATCHED">Te pajtuara</option>
            <option value="ALL">Te gjitha</option>
          </select>
          <select
            value={direction}
            onChange={(event) => {
              setDirection(event.target.value as typeof direction);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="ALL">Te dy drejtimet</option>
            <option value="IN">Hyrje</option>
            <option value="OUT">Dalje</option>
          </select>
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(event) => {
                setSortBy(event.target.value as typeof sortBy);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="statementDate">Data</option>
              <option value="amount">Shuma</option>
              <option value="status">Statusi</option>
              <option value="account">Llogaria</option>
            </select>
            <button
              type="button"
              onClick={() => {
                setAccountId('');
                setStatus('UNMATCHED');
                setDirection('ALL');
                setSearch('');
                setSortBy('statementDate');
                setSortOrder('desc');
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <span className="text-xs text-slate-500">Renditja</span>
          <select
            value={sortOrder}
            onChange={(event) => {
              setSortOrder(event.target.value as 'asc' | 'desc');
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="desc">Zbrites</option>
            <option value="asc">Rrites</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Statement lines</h3>
              <p className="mt-1 text-xs text-slate-500">Zerat nga banka qe presin pajtim me ledger.</p>
            </div>
            <span className="text-xs text-slate-400">Totali: {payload.total}</span>
          </div>

          {loadingList ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
              Duke ngarkuar levizjet bankare...
            </div>
          ) : payload.items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
              Nuk ka statement lines per filtrat aktuale.
            </div>
          ) : (
            <div className="space-y-3">
              {payload.items.map((line) => {
                const active = line.id === selectedId;
                return (
                  <button
                    key={line.id}
                    type="button"
                    onClick={() => setSelectedId(line.id)}
                    className={`w-full rounded-xl border p-4 text-left transition-all ${active ? 'border-indigo-400 bg-indigo-50/60 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-mono text-xs text-slate-500">
                          {line.referenceNo ?? line.externalId ?? 'Pa reference'}
                        </p>
                        <p className="text-sm font-semibold text-slate-900">
                          {line.counterpartyName ?? line.description ?? line.account?.name ?? '-'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatDateOnly(line.statementDate)} | {line.account?.code} - {line.account?.name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Mbetur</p>
                        <p className={`text-lg font-bold ${line.direction === 'IN' ? 'text-emerald-700' : 'text-red-700'}`}>
                          {formatMoney(line.remainingAmount)} EUR
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <StatusBadge value={line.direction} />
                      <StatusBadge value={line.status} />
                      <span className="text-xs text-slate-500">
                        Shuma: {formatMoney(line.amount)} EUR
                      </span>
                      <span className="text-xs text-slate-500">
                        Match: {formatMoney(line.matchedAmount)} EUR
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
          {!selectedId || !selectedLine ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
              Zgjidh nje statement line per te pare kandidatet e match-it.
            </div>
          ) : loadingDetails ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
              Duke ngarkuar workspace-in e pajtimit...
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Workspace i pajtimit</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Perputh statement-in me nje ose disa transaksione nga ledger-i i finances.
                  </p>
                </div>
                <StatusBadge value={selectedLine.status} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Statement</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-slate-900">
                    {selectedLine.referenceNo ?? selectedLine.externalId ?? '-'}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Data</p>
                  <p className="mt-1 font-semibold text-slate-900">{formatDateOnly(selectedLine.statementDate)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Shuma</p>
                  <p className="mt-1 font-semibold text-slate-900">{formatMoney(selectedLine.amount)} EUR</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Mbetur</p>
                  <p className="mt-1 font-semibold text-slate-900">{formatMoney(selectedLine.remainingAmount)} EUR</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Pala</p>
                  <p className="mt-1 font-semibold text-slate-900">{selectedLine.counterpartyName ?? '-'}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Llogaria</p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {selectedLine.account?.code} - {selectedLine.account?.name}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                  <h4 className="text-sm font-semibold text-slate-900">Match-et ekzistuese</h4>
                </div>
                {selectedLine.matches.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-400">
                    Ende nuk ka match per kete statement line.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {selectedLine.matches.map((match) => {
                      const href = resolveDocumentHref(match.transaction);
                      return (
                        <div key={match.id} className="p-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <StatusBadge value={match.transaction?.transactionType} />
                                <span className="font-semibold text-slate-900">
                                  {formatMoney(match.amount)} EUR
                                </span>
                              </div>
                              <p className="mt-2 text-sm text-slate-600">
                                {match.transaction?.counterpartyName ?? match.transaction?.referenceNo ?? '-'}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {formatDateOnly(match.transaction?.transactionDate)} | {match.notes ?? 'Pa shenime'}
                              </p>
                              {href ? (
                                <Link href={href} className="mt-2 inline-block text-xs font-medium text-indigo-700 hover:text-indigo-900">
                                  Hap dokumentin {match.transaction?.sourceDocumentNo}
                                </Link>
                              ) : null}
                            </div>
                            {canManage ? (
                              <button
                                type="button"
                                onClick={() => void handleRemoveMatch(match)}
                                disabled={busyMatchId === match.id}
                                className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                              >
                                {busyMatchId === match.id ? 'Duke hequr...' : 'Hiq match'}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Kandidatet nga ledger</h4>
                    <p className="mt-1 text-xs text-slate-500">
                      Sistemi sugjeron levizjet me llogari, drejtim, shume, date dhe reference me te afert.
                    </p>
                  </div>
                  <span className="text-xs text-slate-400">{workspace?.candidates.length ?? 0} kandidate</span>
                </div>

                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Shenime per match</span>
                  <input
                    type="text"
                    value={matchNotes}
                    onChange={(event) => setMatchNotes(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Opsionale"
                    disabled={!canManage}
                  />
                </label>

                {!canManage ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    Roli yt mund ta shohe pajtimin, por nuk mund te krijoje ose heqe match-e.
                  </div>
                ) : null}

                {Number(selectedLine.remainingAmount ?? 0) <= 0 ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    Ky statement line eshte pajtuar plotesisht.
                  </div>
                ) : null}

                {(workspace?.candidates.length ?? 0) === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                    Nuk u gjeten kandidate te lire per kete statement line.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {workspace?.candidates.map((candidate) => {
                      const href = resolveDocumentHref(candidate);
                      const disabled =
                        !canManage ||
                        Number(selectedLine.remainingAmount ?? 0) <= 0 ||
                        busyCandidateId === candidate.id;

                      return (
                        <div key={candidate.id} className="rounded-xl border border-slate-200 p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <StatusBadge value={candidate.transactionType} />
                                <span className="text-xs text-slate-500">
                                  Score: {formatMoney(candidate.score)}
                                </span>
                              </div>
                              <p className="text-sm font-semibold text-slate-900">
                                {candidate.counterpartyName ?? candidate.sourceDocumentNo ?? candidate.referenceNo ?? '-'}
                              </p>
                              <p className="text-xs text-slate-500">
                                {formatDateOnly(candidate.transactionDate)} | Ref: {candidate.referenceNo ?? '-'}
                              </p>
                              {href ? (
                                <Link href={href} className="text-xs font-medium text-indigo-700 hover:text-indigo-900">
                                  Hap dokumentin {candidate.sourceDocumentNo}
                                </Link>
                              ) : null}
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm lg:min-w-[280px]">
                              <div className="rounded-lg bg-slate-50 p-2">
                                <p className="text-xs text-slate-500">Shuma ledger</p>
                                <p className="font-semibold text-slate-900">{formatMoney(candidate.amount)} EUR</p>
                              </div>
                              <div className="rounded-lg bg-slate-50 p-2">
                                <p className="text-xs text-slate-500">E lire</p>
                                <p className="font-semibold text-slate-900">{formatMoney(candidate.availableAmount)} EUR</p>
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                            <input
                              type="number"
                              min="0.01"
                              max={Math.min(
                                Number(candidate.availableAmount ?? 0),
                                Number(selectedLine.remainingAmount ?? 0),
                              )}
                              step="0.01"
                              value={candidateAmounts[candidate.id] ?? ''}
                              onChange={(event) =>
                                setCandidateAmounts((current) => ({
                                  ...current,
                                  [candidate.id]: event.target.value,
                                }))
                              }
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-40"
                              disabled={!canManage}
                            />
                            <button
                              type="button"
                              onClick={() => void handleMatch(candidate)}
                              disabled={disabled}
                              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                            >
                              {busyCandidateId === candidate.id ? 'Duke pajtuar...' : 'Pajto'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
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
