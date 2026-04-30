'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StatusBadge } from '@/components/status-badge';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/date';

type CashAccount = {
  id: string;
  code: string;
  name: string;
  currentBalance: number | string;
  currencyCode?: string | null;
};

type CashDailyClose = {
  id: string;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  openingBalance: number | string;
  totalIn: number | string;
  totalOut: number | string;
  expectedClosingBalance: number | string;
  countedCashAmount?: number | string | null;
  differenceAmount?: number | string | null;
  openingNotes?: string | null;
  closingNotes?: string | null;
  openedAt?: string | null;
  closedAt?: string | null;
  openedBy?: { fullName?: string | null; email?: string | null } | null;
  closedBy?: { fullName?: string | null; email?: string | null } | null;
};

export type CashDailyCloseRow = {
  account: CashAccount;
  close?: CashDailyClose | null;
  totalIn: number | string;
  totalOut: number | string;
  expectedClosingBalance: number | string;
  status: 'NOT_OPENED' | 'OPEN' | 'CLOSED' | 'CANCELLED';
};

export type CashDailyCloseSummary = {
  businessDate: string;
  summary: {
    cashAccountCount: number;
    openedCount: number;
    closedCount: number;
    notOpenedCount: number;
    totalExpectedClosing: number | string;
    totalCounted: number | string;
    totalDifference: number | string;
  };
  rows: CashDailyCloseRow[];
};

function money(value?: number | string | null) {
  return Number(value ?? 0).toLocaleString('sq-AL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function dateInputValue(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
}

function parseApiError(error: unknown) {
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message);
      if (typeof parsed.message === 'string') return parsed.message;
    } catch {}
    return error.message;
  }
  return 'Veprimi dështoi.';
}

export function CashDailyCloseClient({
  initialSummary,
  canManage,
}: {
  initialSummary: CashDailyCloseSummary;
  canManage: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [countedAmounts, setCountedAmounts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const businessDate = dateInputValue(initialSummary.businessDate);

  const diffPreview = useMemo(() => {
    const result: Record<string, number> = {};
    for (const row of initialSummary.rows) {
      const counted = Number(countedAmounts[row.account.id] ?? row.close?.countedCashAmount ?? 0);
      if (countedAmounts[row.account.id] !== undefined) {
        result[row.account.id] = Math.round((counted - Number(row.expectedClosingBalance ?? 0)) * 100) / 100;
      }
    }
    return result;
  }, [countedAmounts, initialSummary.rows]);

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key);
    setError(null);
    setSuccess(null);
    try {
      await action();
      router.refresh();
    } catch (nextError) {
      setError(parseApiError(nextError));
    } finally {
      setBusy(null);
    }
  }

  function changeDate(nextDate: string) {
    router.push(`/financa/mbyllja-ditore?date=${encodeURIComponent(nextDate)}`);
  }

  return (
    <div className="space-y-5">
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{success}</div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Data e punës</label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={businessDate}
            onChange={(event) => changeDate(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => changeDate(new Date().toISOString().slice(0, 10))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Sot
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Arka aktive</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{initialSummary.summary.cashAccountCount}</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Hapur</p>
          <p className="mt-1 text-2xl font-bold text-blue-900">{initialSummary.summary.openedCount}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Mbyllur</p>
          <p className="mt-1 text-2xl font-bold text-emerald-900">{initialSummary.summary.closedCount}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Diferenca totale</p>
          <p className="mt-1 text-2xl font-bold text-amber-900">{money(initialSummary.summary.totalDifference)} EUR</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Mbyllja ditore sipas arkës</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Arka</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Hyrje</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Dalje</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Pritet</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Veprim</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {initialSummary.rows.map((row) => {
                const closeId = row.close?.id;
                const difference = diffPreview[row.account.id] ?? row.close?.differenceAmount;
                return (
                  <tr key={row.account.id} className="align-top">
                    <td className="px-4 py-4">
                      <div className="font-semibold text-slate-900">{row.account.code} - {row.account.name}</div>
                      <div className="mt-1 text-xs text-slate-500">Balanca aktuale: {money(row.account.currentBalance)} {row.account.currencyCode ?? 'EUR'}</div>
                      {row.close?.openedAt ? (
                        <div className="mt-1 text-xs text-slate-400">Hapur: {formatDateTime(row.close.openedAt)}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge value={row.status} />
                    </td>
                    <td className="px-4 py-4 text-right text-slate-700">{money(row.totalIn)}</td>
                    <td className="px-4 py-4 text-right text-slate-700">{money(row.totalOut)}</td>
                    <td className="px-4 py-4 text-right font-semibold text-slate-900">{money(row.expectedClosingBalance)}</td>
                    <td className="px-4 py-4">
                      {!canManage ? (
                        <span className="text-xs text-slate-400">Vetëm lexim</span>
                      ) : row.status === 'NOT_OPENED' || row.status === 'CANCELLED' ? (
                        <div className="space-y-2">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Opening balance"
                            value={countedAmounts[row.account.id] ?? money(row.account.currentBalance).replace(',', '.')}
                            onChange={(event) =>
                              setCountedAmounts((current) => ({
                                ...current,
                                [row.account.id]: event.target.value,
                              }))
                            }
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          />
                          <input
                            type="text"
                            placeholder="Shënim hapjeje"
                            value={notes[row.account.id] ?? ''}
                            onChange={(event) =>
                              setNotes((current) => ({ ...current, [row.account.id]: event.target.value }))
                            }
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          />
                          <button
                            type="button"
                            disabled={busy === `open-${row.account.id}`}
                            onClick={() =>
                              void run(`open-${row.account.id}`, async () => {
                                await api.post('cash-daily-close/open', {
                                  financeAccountId: row.account.id,
                                  businessDate,
                                  openingBalance: Number(countedAmounts[row.account.id] ?? row.account.currentBalance ?? 0),
                                  openingNotes: notes[row.account.id] || undefined,
                                });
                                setSuccess('Dita u hap me sukses.');
                              })
                            }
                            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                          >
                            Hap ditën
                          </button>
                        </div>
                      ) : row.status === 'OPEN' && closeId ? (
                        <div className="space-y-2">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Cash i numëruar"
                            value={countedAmounts[row.account.id] ?? ''}
                            onChange={(event) =>
                              setCountedAmounts((current) => ({
                                ...current,
                                [row.account.id]: event.target.value,
                              }))
                            }
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          />
                          <div className="text-xs text-slate-500">
                            Diferenca: <strong>{money(difference)} EUR</strong>
                          </div>
                          <input
                            type="text"
                            placeholder="Shënim mbylljeje"
                            value={notes[row.account.id] ?? ''}
                            onChange={(event) =>
                              setNotes((current) => ({ ...current, [row.account.id]: event.target.value }))
                            }
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          />
                          <button
                            type="button"
                            disabled={busy === `close-${closeId}` || !countedAmounts[row.account.id]}
                            onClick={() =>
                              void run(`close-${closeId}`, async () => {
                                await api.post(`cash-daily-close/${closeId}/close`, {
                                  countedCashAmount: Number(countedAmounts[row.account.id] ?? 0),
                                  closingNotes: notes[row.account.id] || undefined,
                                });
                                setSuccess('Dita u mbyll me sukses.');
                              })
                            }
                            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                          >
                            Mbyll ditën
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500">
                          Numëruar: {money(row.close?.countedCashAmount)} EUR
                          <br />
                          Diferenca: {money(row.close?.differenceAmount)} EUR
                          {row.close?.closedAt ? (
                            <>
                              <br />
                              Mbyllur: {formatDateTime(row.close.closedAt)}
                            </>
                          ) : null}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!initialSummary.rows.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                    Nuk ka arka aktive për mbyllje ditore.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
