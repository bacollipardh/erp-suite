'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { StatusBadge } from '@/components/status-badge';
import { api } from '@/lib/api';
import { formatDateOnly } from '@/lib/date';
import { triggerCsvDownload } from '@/lib/report-export';

type BankAccountOption = {
  id: string;
  code: string;
  name: string;
};

type BankReconciliationReport = {
  summary: {
    statementCount: number;
    statementVisibleCount: number;
    statementTotal: number;
    unmatchedCount: number;
    partiallyMatchedCount: number;
    matchedCount: number;
    statementTotalAmount: number;
    statementMatchedAmount: number;
    statementRemainingAmount: number;
    ledgerUnmatchedCount: number;
    ledgerUnmatchedAmount: number;
    differenceAmount: number;
  };
  byAccount: {
    account: BankAccountOption;
    statementCount: number;
    unmatchedCount: number;
    partiallyMatchedCount: number;
    matchedCount: number;
    statementAmount: number;
    matchedAmount: number;
    statementRemaining: number;
    ledgerUnmatchedCount: number;
    ledgerUnmatchedAmount: number;
  }[];
  statementLines: {
    id: string;
    statementDate: string;
    valueDate?: string | null;
    direction: string;
    status: string;
    amount: number;
    matchedAmount: number;
    remainingAmount: number;
    referenceNo?: string | null;
    externalId?: string | null;
    counterpartyName?: string | null;
    description?: string | null;
    account: BankAccountOption;
  }[];
  unmatchedLedgerTransactions: {
    id: string;
    transactionType: string;
    direction: string;
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
    account: BankAccountOption;
  }[];
  page: number;
  limit: number;
  total: number;
  pageCount: number;
};

function fmt(value?: number | string | null) {
  return Number(value ?? 0).toLocaleString('sq-AL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function csvEscape(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function csvRow(values: Array<string | number | null | undefined>) {
  return values.map(csvEscape).join(',');
}

function parseApiError(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Raporti i pajtimit bankar deshtoi.';
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
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

function buildStatementCsv(report: BankReconciliationReport) {
  return [
    csvRow([
      'Statement Report',
      'Account',
      'Date',
      'Direction',
      'Status',
      'Reference',
      'External ID',
      'Counterparty',
      'Amount',
      'Matched',
      'Remaining',
    ]),
    ...report.statementLines.map((row) =>
      csvRow([
        'Unmatched statement lines',
        `${row.account.code} - ${row.account.name}`,
        formatDateOnly(row.statementDate),
        row.direction,
        row.status,
        row.referenceNo,
        row.externalId,
        row.counterpartyName,
        fmt(row.amount),
        fmt(row.matchedAmount),
        fmt(row.remainingAmount),
      ]),
    ),
  ].join('\n');
}

function buildLedgerCsv(report: BankReconciliationReport) {
  return [
    csvRow([
      'Ledger Report',
      'Account',
      'Date',
      'Type',
      'Direction',
      'Reference',
      'Counterparty',
      'Source Document',
      'Amount',
      'Matched',
      'Available',
    ]),
    ...report.unmatchedLedgerTransactions.map((row) =>
      csvRow([
        'Unmatched ledger transactions',
        `${row.account.code} - ${row.account.name}`,
        formatDateOnly(row.transactionDate),
        row.transactionType,
        row.direction,
        row.referenceNo,
        row.counterpartyName,
        row.sourceDocumentNo,
        fmt(row.amount),
        fmt(row.matchedAmount),
        fmt(row.availableAmount),
      ]),
    ),
  ].join('\n');
}

export function BankReconciliationReportClient({
  bankAccounts,
}: {
  bankAccounts: BankAccountOption[];
}) {
  const [financeAccountId, setFinanceAccountId] = useState('');
  const [status, setStatus] = useState<'ALL' | 'UNMATCHED' | 'PARTIALLY_MATCHED' | 'MATCHED'>('ALL');
  const [direction, setDirection] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('statementDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [report, setReport] = useState<BankReconciliationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadReport() {
    setLoading(true);
    setError(null);

    try {
      const response = (await api.query('reports/bank-reconciliation', {
        financeAccountId,
        status: status === 'ALL' ? undefined : status,
        direction: direction === 'ALL' ? undefined : direction,
        dateFrom,
        dateTo,
        search,
        sortBy,
        sortOrder,
        page,
        limit: 50,
      })) as BankReconciliationReport;
      setReport(response);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReport();
  }, [dateFrom, dateTo, direction, financeAccountId, page, search, sortBy, sortOrder, status]);

  const summary = report?.summary ?? {
    statementCount: 0,
    statementVisibleCount: 0,
    statementTotal: 0,
    unmatchedCount: 0,
    partiallyMatchedCount: 0,
    matchedCount: 0,
    statementTotalAmount: 0,
    statementMatchedAmount: 0,
    statementRemainingAmount: 0,
    ledgerUnmatchedCount: 0,
    ledgerUnmatchedAmount: 0,
    differenceAmount: 0,
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Bank Reconciliation Reports</h2>
            <p className="mt-1 text-sm text-slate-600">
              Kontrollo statement lines pa pajtim, ledger transactions pa pajtim dhe diferencat sipas bankes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                report &&
                triggerCsvDownload(
                  `bank-statement-unmatched-${new Date().toISOString().slice(0, 10)}.csv`,
                  buildStatementCsv(report),
                )
              }
              disabled={!report}
              className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-medium text-emerald-700 disabled:opacity-50"
            >
              Export Statement CSV
            </button>
            <button
              type="button"
              onClick={() =>
                report &&
                triggerCsvDownload(
                  `bank-ledger-unmatched-${new Date().toISOString().slice(0, 10)}.csv`,
                  buildLedgerCsv(report),
                )
              }
              disabled={!report}
              className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
            >
              Export Ledger CSV
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          <input
            type="text"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Kerko reference, pale, dokument..."
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm xl:col-span-2"
          />
          <select
            value={financeAccountId}
            onChange={(event) => {
              setFinanceAccountId(event.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Te gjitha bankat</option>
            {bankAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.code} - {account.name}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as typeof status);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="ALL">Te gjitha statuset</option>
            <option value="UNMATCHED">Pa Match</option>
            <option value="PARTIALLY_MATCHED">Pjeserisht</option>
            <option value="MATCHED">Te pajtuara</option>
          </select>
          <select
            value={direction}
            onChange={(event) => {
              setDirection(event.target.value as typeof direction);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="ALL">Te dy drejtimet</option>
            <option value="IN">Hyrje</option>
            <option value="OUT">Dalje</option>
          </select>
          <button
            type="button"
            onClick={() => {
              setFinanceAccountId('');
              setStatus('ALL');
              setDirection('ALL');
              setDateFrom('');
              setDateTo('');
              setSearch('');
              setSortBy('statementDate');
              setSortOrder('desc');
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Reseto
          </button>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => {
              setDateFrom(event.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(event) => {
              setDateTo(event.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <select
            value={sortBy}
            onChange={(event) => {
              setSortBy(event.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="statementDate">Data</option>
            <option value="amount">Shuma</option>
            <option value="status">Statusi</option>
            <option value="account">Banka</option>
          </select>
          <select
            value={sortOrder}
            onChange={(event) => {
              setSortOrder(event.target.value as 'asc' | 'desc');
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="desc">Zbrites</option>
            <option value="asc">Rrites</option>
          </select>
          <Link
            href="/financa/pajtimi-bankar"
            className="rounded-lg border border-indigo-300 bg-white px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
          >
            Hap pajtimin
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 xl:grid-cols-6 gap-3">
        <StatCard label="Statement Pa Match" value={summary.unmatchedCount} />
        <StatCard label="Pjeserisht" value={summary.partiallyMatchedCount} />
        <StatCard label="Te Pajtura" value={summary.matchedCount} />
        <StatCard
          label="Statement Mbetur"
          value={`${fmt(summary.statementRemainingAmount)} EUR`}
          sub={`${fmt(summary.statementMatchedAmount)} EUR te pajtuara`}
        />
        <StatCard
          label="Ledger Pa Match"
          value={`${fmt(summary.ledgerUnmatchedAmount)} EUR`}
          sub={`${summary.ledgerUnmatchedCount} levizje`}
        />
        <StatCard
          label="Diferenca"
          value={`${fmt(summary.differenceAmount)} EUR`}
          sub="Statement mbetur - ledger pa match"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-900">Reconciliation summary by bank account</h3>
        </div>
        {(report?.byAccount ?? []).length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-400">
            Nuk ka te dhena per filtrat aktuale.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5">Banka</th>
                  <th className="px-4 py-2.5 text-right">Statement</th>
                  <th className="px-4 py-2.5 text-right">Pa / Pjese / Pajtua</th>
                  <th className="px-4 py-2.5 text-right">Statement Mbetur</th>
                  <th className="px-4 py-2.5 text-right">Ledger Pa Match</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(report?.byAccount ?? []).map((row) => (
                  <tr key={row.account.id}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-slate-900">{row.account.name}</p>
                      <p className="font-mono text-xs text-slate-500">{row.account.code}</p>
                    </td>
                    <td className="px-4 py-2.5 text-right">{row.statementCount}</td>
                    <td className="px-4 py-2.5 text-right">
                      {row.unmatchedCount} / {row.partiallyMatchedCount} / {row.matchedCount}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-900">
                      {fmt(row.statementRemaining)} EUR
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-700">
                      {fmt(row.ledgerUnmatchedAmount)} EUR
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <h3 className="text-sm font-semibold text-slate-900">Unmatched bank statement lines</h3>
            <p className="mt-1 text-xs text-slate-500">
              {loading ? 'Duke ngarkuar...' : `${summary.statementTotal} rreshta sipas filtrit`}
            </p>
          </div>
          {(report?.statementLines ?? []).length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              Nuk ka statement lines per filtrat aktuale.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2.5">Data / Banka</th>
                    <th className="px-4 py-2.5">Pala / Ref</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5 text-right">Mbetur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(report?.statementLines ?? []).map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-2.5">
                        <p className="text-slate-700">{formatDateOnly(row.statementDate)}</p>
                        <p className="font-mono text-xs text-slate-500">{row.account.code}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-slate-900">{row.counterpartyName ?? '-'}</p>
                        <p className="text-xs text-slate-500">{row.referenceNo ?? row.externalId ?? '-'}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge value={row.direction} />
                          <StatusBadge value={row.status} />
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-slate-900">
                        {fmt(row.remainingAmount)} EUR
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-3 text-sm">
            <span className="text-slate-500">
              Faqja {report?.page ?? page} / {report?.pageCount ?? 1}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={(report?.page ?? 1) <= 1}
                className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-50"
              >
                Mbrapa
              </button>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(report?.pageCount ?? 1, current + 1))}
                disabled={(report?.page ?? 1) >= (report?.pageCount ?? 1)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-50"
              >
                Para
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <h3 className="text-sm font-semibold text-slate-900">Unmatched ledger transactions</h3>
            <p className="mt-1 text-xs text-slate-500">
              Transaksione ne ledger qe ende kane shume te lire per pajtim.
            </p>
          </div>
          {(report?.unmatchedLedgerTransactions ?? []).length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              Nuk ka ledger transactions pa pajtim per filtrat aktuale.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2.5">Data / Banka</th>
                    <th className="px-4 py-2.5">Burimi</th>
                    <th className="px-4 py-2.5">Tipi</th>
                    <th className="px-4 py-2.5 text-right">E lire</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(report?.unmatchedLedgerTransactions ?? []).map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-2.5">
                        <p className="text-slate-700">{formatDateOnly(row.transactionDate)}</p>
                        <p className="font-mono text-xs text-slate-500">{row.account.code}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-slate-900">
                          {row.counterpartyName ?? row.sourceDocumentNo ?? '-'}
                        </p>
                        <p className="text-xs text-slate-500">{row.referenceNo ?? row.notes ?? '-'}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge value={row.transactionType} />
                          <StatusBadge value={row.direction} />
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-slate-900">
                        {fmt(row.availableAmount)} EUR
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
