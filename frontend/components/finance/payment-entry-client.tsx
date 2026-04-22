'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DueStateReminder } from '@/components/finance/due-state-reminder';
import { StatsCard } from '@/components/stats-card';
import { StatusBadge } from '@/components/status-badge';
import { api } from '@/lib/api';
import { formatDateOnly, toDateInputValue } from '@/lib/date';

type OpenDocument = {
  id: string;
  docNo: string;
  docDate: string;
  dueDate?: string | null;
  total: number;
  paid: number;
  outstanding: number;
  daysPastDue: number;
  dueState: string;
  party?: { id: string; name: string } | null;
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

function calculatePaymentAllocation(amount: number, outstanding: number) {
  const enteredAmount = roundMoney(Math.max(0, Number(amount ?? 0)));
  const remainingAmount = roundMoney(Math.max(0, Number(outstanding ?? 0)));
  const appliedAmount = roundMoney(Math.min(enteredAmount, remainingAmount));
  const unappliedAmount = roundMoney(Math.max(0, enteredAmount - appliedAmount));

  return {
    enteredAmount,
    appliedAmount,
    unappliedAmount,
    remainingAmount,
  };
}

function parseApiError(error: unknown) {
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message);
      if (typeof parsed.message === 'string') return parsed.message;
    } catch {}

    return error.message;
  }

  return 'Ndodhi nje gabim gjate regjistrimit.';
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

export function PaymentEntryClient({
  mode,
  documents,
  detailBasePath,
  submitBasePath,
  listHref,
  initialDocumentId,
}: {
  mode: 'receipt' | 'payment';
  documents: OpenDocument[];
  detailBasePath: string;
  submitBasePath: 'sales-invoices' | 'purchase-invoices';
  listHref: string;
  initialDocumentId?: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(documents);
  const [selectedId, setSelectedId] = useState(initialDocumentId ?? documents[0]?.id ?? '');
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<'ALL' | 'OVERDUE' | 'DUE_TODAY'>('ALL');
  const [amount, setAmount] = useState('');
  const [paidAt, setPaidAt] = useState(toDateInputValue(new Date()));
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');
  const [allowUnapplied, setAllowUnapplied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const labels =
    mode === 'receipt'
      ? {
          party: 'Klienti',
          title: 'Arketim i ri',
          button: 'Regjistro arketimin',
          success: 'Arketimi u regjistrua me sukses.',
          empty: 'Nuk ka fatura te hapura per arketim.',
          verb: 'arketimin',
        }
      : {
          party: 'Furnitori',
          title: 'Pagese e re',
          button: 'Regjistro pagesen',
          success: 'Pagesa u regjistrua me sukses.',
          empty: 'Nuk ka fatura te hapura per pagese.',
          verb: 'pagesen',
        };

  const visibleDocuments = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return [...items]
      .filter((item) => {
        if (scope !== 'ALL' && item.dueState !== scope) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        const haystack = [item.docNo, item.party?.name]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return haystack.includes(normalizedSearch);
      })
      .sort((left, right) => {
        const priority = duePriority(left.dueState) - duePriority(right.dueState);
        if (priority !== 0) return priority;
        if (left.daysPastDue !== right.daysPastDue) return right.daysPastDue - left.daysPastDue;
        return left.docNo.localeCompare(right.docNo, 'sq', { sensitivity: 'base' });
      });
  }, [items, scope, search]);

  const selectedDocument =
    items.find((item) => item.id === selectedId) ?? visibleDocuments[0] ?? null;

  useEffect(() => {
    if (!selectedDocument && visibleDocuments.length > 0) {
      setSelectedId(visibleDocuments[0].id);
    }
  }, [selectedDocument, visibleDocuments]);

  useEffect(() => {
    if (selectedDocument) {
      if (selectedId !== selectedDocument.id) {
        setSelectedId(selectedDocument.id);
      }
      setAmount(selectedDocument.outstanding.toFixed(2));
      setAllowUnapplied(false);
    } else {
      setAmount('');
      setAllowUnapplied(false);
    }
  }, [selectedDocument?.id, selectedDocument?.outstanding, selectedId]);

  const paymentPreview = useMemo(() => {
    if (!selectedDocument) {
      return calculatePaymentAllocation(0, 0);
    }

    return calculatePaymentAllocation(Number(amount), Number(selectedDocument.outstanding ?? 0));
  }, [amount, selectedDocument]);

  const summary = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc.outstanding += Number(item.outstanding ?? 0);
        acc.overdue += item.dueState === 'OVERDUE' ? 1 : 0;
        acc.dueToday += item.dueState === 'DUE_TODAY' ? 1 : 0;
        return acc;
      },
      { outstanding: 0, overdue: 0, dueToday: 0 },
    );
  }, [items]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedDocument) return;

    setBusy(true);
    setError(null);
    setMessage(null);

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setBusy(false);
      setError(`Shkruaj nje shume valide per ${labels.verb}.`);
      return;
    }

    if (paymentPreview.appliedAmount <= 0) {
      setBusy(false);
      setError('Dokumenti nuk ka me vlere te hapur per kete veprim.');
      return;
    }

    if (paymentPreview.unappliedAmount > 0 && !allowUnapplied) {
      setBusy(false);
      setError(
        'Shuma kalon vleren e mbetur ne dokument. Aktivizo opsionin per te ruajtur tepricen si unapplied.',
      );
      return;
    }

    try {
      await api.post(`${submitBasePath}/${selectedDocument.id}/payments`, {
        amount: numericAmount,
        paidAt,
        referenceNo: referenceNo || undefined,
        notes: notes || undefined,
        allowUnapplied,
      });

      setItems((current) =>
        current.flatMap((item) => {
          if (item.id !== selectedDocument.id) return [item];

          const nextPaid = Number(item.paid ?? 0) + paymentPreview.appliedAmount;
          const nextOutstanding = Math.max(
            0,
            Number(item.outstanding ?? 0) - paymentPreview.appliedAmount,
          );

          if (nextOutstanding <= 0) {
            return [];
          }

          return [
            {
              ...item,
              paid: nextPaid,
              outstanding: nextOutstanding,
            },
          ];
        }),
      );

      setReferenceNo('');
      setNotes('');
      setAllowUnapplied(false);
      setMessage(
        paymentPreview.unappliedAmount > 0
          ? `${labels.success} ${formatMoney(paymentPreview.appliedAmount)} EUR u aplikuan ne dokument dhe ${formatMoney(paymentPreview.unappliedAmount)} EUR mbeten si unapplied.`
          : labels.success,
      );
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatsCard
          title="Dokumente te hapura"
          value={items.length}
          subtitle={`${summary.overdue} me vonese`}
        />
        <StatsCard
          title="Totali i hapur"
          value={`${formatMoney(summary.outstanding)} EUR`}
          subtitle={`${summary.dueToday} skadojne sot`}
        />
        <StatsCard title="Ne vonese" value={summary.overdue} subtitle="Prioritet i larte" />
        <StatsCard title="Sot" value={summary.dueToday} subtitle="Kerkon veprim brenda dites" />
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

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Dokumentet e hapura</h2>
              <p className="mt-1 text-sm text-slate-500">
                Zgjidh dokumentin qe do te trajtohet nga kjo faqe.
              </p>
            </div>
            <Link
              href={listHref}
              className="text-sm font-medium text-indigo-700 hover:text-indigo-900"
            >
              Shiko aktivitetin
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Kerko me nr. dokumenti ose ${labels.party.toLowerCase()}...`}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setScope('ALL')}
                className={`rounded-lg px-3 py-2 text-sm ${scope === 'ALL' ? 'bg-slate-900 text-white' : 'border border-slate-300 text-slate-600'}`}
              >
                Te gjitha
              </button>
              <button
                type="button"
                onClick={() => setScope('OVERDUE')}
                className={`rounded-lg px-3 py-2 text-sm ${scope === 'OVERDUE' ? 'bg-red-700 text-white' : 'border border-slate-300 text-slate-600'}`}
              >
                Ne vonese
              </button>
              <button
                type="button"
                onClick={() => setScope('DUE_TODAY')}
                className={`rounded-lg px-3 py-2 text-sm ${scope === 'DUE_TODAY' ? 'bg-amber-600 text-white' : 'border border-slate-300 text-slate-600'}`}
              >
                Sot
              </button>
            </div>
          </div>

          {visibleDocuments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
              {labels.empty}
            </div>
          ) : (
            <div className="space-y-3">
              {visibleDocuments.map((item) => {
                const active = item.id === selectedDocument?.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full rounded-xl border p-4 text-left transition-all ${active ? 'border-indigo-400 bg-indigo-50/60 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="font-mono text-xs text-slate-500">{item.docNo}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {item.party?.name ?? '-'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Data: {formatDateOnly(item.docDate)} | Afati: {formatDateOnly(item.dueDate)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Mbetur</p>
                        <p className="text-lg font-bold text-slate-900">
                          {formatMoney(item.outstanding)} EUR
                        </p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <DueStateReminder
                        compact
                        dueState={item.dueState}
                        dueDate={item.dueDate}
                        daysPastDue={item.daysPastDue}
                        outstandingAmount={item.outstanding}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{labels.title}</h2>
            <p className="mt-1 text-sm text-slate-500">
              Regjistro transaksionin direkt dhe rifresko gjendjen pa hyre ne edit form te dokumentit.
            </p>
          </div>

          {!selectedDocument ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
              Zgjidh nje dokument nga lista ne anen e majte.
            </div>
          ) : (
            <>
              <DueStateReminder
                dueState={selectedDocument.dueState}
                dueDate={selectedDocument.dueDate}
                daysPastDue={selectedDocument.daysPastDue}
                outstandingAmount={selectedDocument.outstanding}
              />

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Dokumenti</p>
                  <p className="mt-1 font-semibold text-slate-900">{selectedDocument.docNo}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">{labels.party}</p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {selectedDocument.party?.name ?? '-'}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Totali</p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {formatMoney(selectedDocument.total)} EUR
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Paguar</p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {formatMoney(selectedDocument.paid)} EUR
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Mbetur</p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {formatMoney(selectedDocument.outstanding)} EUR
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Statusi</p>
                  <div className="mt-2">
                    <StatusBadge value={selectedDocument.dueState} />
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Shuma</span>
                  <input
                    type="number"
                    min={0.01}
                    max={allowUnapplied ? undefined : selectedDocument.outstanding}
                    step="0.01"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Data</span>
                  <input
                    type="date"
                    value={paidAt}
                    onChange={(event) => setPaidAt(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Referenca</span>
                  <input
                    type="text"
                    value={referenceNo}
                    onChange={(event) => setReferenceNo(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Shenime</span>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>

                <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={allowUnapplied}
                    onChange={(event) => setAllowUnapplied(event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>
                    Lejo tepricen si `unapplied` kur shuma kalon vleren e mbetur te dokumentit.
                  </span>
                </label>

                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                  <p className="font-medium text-slate-800">Preview i aplikimit</p>
                  <div className="mt-2 grid grid-cols-1 gap-2 text-slate-600 sm:grid-cols-3">
                    <p>Hyrja: {formatMoney(paymentPreview.enteredAmount)} EUR</p>
                    <p>Aplikuar: {formatMoney(paymentPreview.appliedAmount)} EUR</p>
                    <p>Unapplied: {formatMoney(paymentPreview.unappliedAmount)} EUR</p>
                  </div>
                  {paymentPreview.unappliedAmount > 0 && !allowUnapplied ? (
                    <p className="mt-2 text-xs text-amber-700">
                      Aktivizo opsionin sipas mesiper per te ruajtur tepricen pa e refuzuar pagesen.
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex gap-3 text-sm">
                    <Link
                      href={`${detailBasePath}/${selectedDocument.id}`}
                      className="font-medium text-indigo-700 hover:text-indigo-900"
                    >
                      Hap dokumentin
                    </Link>
                    <button
                      type="button"
                      onClick={() => router.push(listHref)}
                      className="font-medium text-slate-600 hover:text-slate-900"
                    >
                      Kthehu te aktiviteti
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {busy ? 'Duke regjistruar...' : labels.button}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
