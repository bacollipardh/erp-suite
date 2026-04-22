'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { DueStateReminder } from '@/components/finance/due-state-reminder';
import { formatDateOnly, formatDateTime, toDateInputValue } from '@/lib/date';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { useSession } from '@/components/session-provider';
import { StatusBadge } from '@/components/status-badge';

type DocumentType = 'sales-invoices' | 'purchase-invoices' | 'sales-returns';

type PaymentEntry = {
  id: string;
  sequence?: number;
  amount: number | string;
  enteredAmount?: number | string | null;
  appliedAmount?: number | string | null;
  unappliedAmount?: number | string | null;
  allowUnapplied?: boolean;
  sourceDocumentNo?: string | null;
  sourceDocumentType?: string | null;
  financeSettlementId?: string | null;
  financeSettlementAllocationId?: string | null;
  isReallocation?: boolean;
  paidAt: string;
  createdAt?: string;
  amountPaidBefore?: number | string | null;
  amountPaidAfter?: number | string | null;
  outstandingBefore?: number | string | null;
  outstandingAfter?: number | string | null;
  remainingAmount?: number | string | null;
  settlementTotal?: number | string | null;
  paymentStatusBefore?: string | null;
  paymentStatusAfter?: string | null;
  usedFallbackSnapshot?: boolean;
  referenceNo?: string | null;
  notes?: string | null;
  user?: { id: string; fullName: string; email?: string | null } | null;
};

function formatMoney(value: number) {
  return value.toLocaleString('sq-AL', {
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

  return 'Ndodhi nje gabim gjate veprimit.';
}

export function DocumentActionPanel({
  documentType,
  documentId,
  docNo,
  status,
  grandTotal,
  amountPaid,
  outstandingAmount,
  settlementTotal,
  creditedAmount,
  settlementStatus,
  paymentStatus,
  dueDate,
  dueState,
  daysPastDue,
  payments = [],
  fiscalStatus,
  fiscalReference,
  fiscalError,
}: {
  documentType: DocumentType;
  documentId: string;
  docNo: string;
  status: string;
  grandTotal: number | string;
  amountPaid?: number | string | null;
  outstandingAmount?: number | string | null;
  settlementTotal?: number | string | null;
  creditedAmount?: number | string | null;
  settlementStatus?: string | null;
  paymentStatus?: string | null;
  dueDate?: string | null;
  dueState?: string | null;
  daysPastDue?: number | null;
  payments?: PaymentEntry[];
  fiscalStatus?: string | null;
  fiscalReference?: string | null;
  fiscalError?: string | null;
}) {
  const router = useRouter();
  const { user } = useSession();

  const total = Number(grandTotal ?? 0);
  const paid = Number(amountPaid ?? 0);
  const settlementBase = Number(settlementTotal ?? total);
  const credited = Number(creditedAmount ?? 0);
  const remaining = Math.max(
    0,
    Number(outstandingAmount ?? Math.max(0, settlementBase - paid)),
  );

  const canRecordPayment =
    (documentType === 'sales-invoices' &&
      hasPermission(user?.permissions, PERMISSIONS.salesInvoicesPay)) ||
    (documentType === 'purchase-invoices' &&
      hasPermission(user?.permissions, PERMISSIONS.purchaseInvoicesPay));

  const canFiscalize =
    (documentType === 'sales-invoices' || documentType === 'sales-returns') &&
    hasPermission(user?.permissions, PERMISSIONS.fiscalize);

  const dedicatedPaymentHref =
    documentType === 'sales-invoices'
      ? `/arketime/new?documentId=${documentId}`
      : documentType === 'purchase-invoices'
        ? `/pagesat/new?documentId=${documentId}`
        : null;
  const paymentActivityHref =
    documentType === 'sales-invoices'
      ? `/arketime?search=${encodeURIComponent(docNo)}`
      : documentType === 'purchase-invoices'
        ? `/pagesat?search=${encodeURIComponent(docNo)}`
        : null;
  const reallocationHref =
    documentType === 'sales-invoices'
      ? `/arketime/rialokime?search=${encodeURIComponent(docNo)}`
      : documentType === 'purchase-invoices'
        ? `/pagesat/rialokime?search=${encodeURIComponent(docNo)}`
        : null;

  const paymentActionBlocked =
    status === 'DRAFT' || status === 'CANCELLED' || status === 'STORNO' || remaining <= 0;

  const [amount, setAmount] = useState(remaining > 0 ? remaining.toFixed(2) : '');
  const [paidAt, setPaidAt] = useState(toDateInputValue(new Date()));
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');
  const [allowUnapplied, setAllowUnapplied] = useState(false);
  const [busyPayment, setBusyPayment] = useState(false);
  const [busyFiscal, setBusyFiscal] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fiscalEndpoint = useMemo(() => {
    if (documentType === 'sales-invoices') {
      return `fiscalization/sales-invoices/${documentId}/submit`;
    }
    if (documentType === 'sales-returns') {
      return `fiscalization/sales-returns/${documentId}/submit`;
    }
    return null;
  }, [documentId, documentType]);

  const paymentPreview = useMemo(
    () => calculatePaymentAllocation(Number(amount), remaining),
    [amount, remaining],
  );

  const reconciliation = useMemo(() => {
    const historyTotal = roundMoney(
      payments.reduce(
        (sum, entry) => sum + Number(entry.appliedAmount ?? entry.amount ?? 0),
        0,
      ),
    );
    const unappliedTotal = roundMoney(
      payments.reduce((sum, entry) => sum + Number(entry.unappliedAmount ?? 0), 0),
    );
    const delta = roundMoney(paid - historyTotal);
    const hasHistory = payments.length > 0;
    const hasMismatch = Math.abs(delta) >= 0.01;
    const hasLegacyFallback = payments.some((entry) => Boolean(entry.usedFallbackSnapshot));
    const hasAggregateWithoutHistory = paid > 0 && !hasHistory;
    const isOverpaid = paid - settlementBase > 0.009;
    const latestPayment = hasHistory ? payments[payments.length - 1] : null;

    return {
      historyTotal,
      delta,
      hasHistory,
      hasMismatch,
      hasLegacyFallback,
      hasAggregateWithoutHistory,
      isOverpaid,
      unappliedTotal,
      latestPayment,
      transactionCount: payments.length,
    };
  }, [paid, payments, settlementBase]);

  async function handlePayment(e: FormEvent) {
    e.preventDefault();
    setBusyPayment(true);
    setError(null);
    setMessage(null);

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setBusyPayment(false);
      setError('Shkruaj nje shume valide per pagesen.');
      return;
    }

    if (paymentPreview.appliedAmount <= 0) {
      setBusyPayment(false);
      setError('Dokumenti nuk ka me vlere te hapur per pagese.');
      return;
    }

    if (paymentPreview.unappliedAmount > 0 && !allowUnapplied) {
      setBusyPayment(false);
      setError(
        'Shuma kalon vleren e mbetur. Aktivizo opsionin per ta ruajtur tepricen si unapplied.',
      );
      return;
    }

    try {
      await api.post(`${documentType}/${documentId}/payments`, {
        amount: numericAmount,
        paidAt,
        referenceNo: referenceNo || undefined,
        notes: notes || undefined,
        allowUnapplied,
      });

      setAmount('');
      setReferenceNo('');
      setNotes('');
      setAllowUnapplied(false);
      setMessage(
        paymentPreview.unappliedAmount > 0
          ? `Pagesa u regjistrua me sukses. ${formatMoney(paymentPreview.appliedAmount)} EUR u aplikuan ne dokument dhe ${formatMoney(paymentPreview.unappliedAmount)} EUR mbeten si unapplied.`
          : 'Pagesa u regjistrua me sukses.',
      );
      router.refresh();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusyPayment(false);
    }
  }

  async function handleFiscalization() {
    if (!fiscalEndpoint) return;
    if (!window.confirm(`Dergo dokumentin ${docNo} per fiskalizim?`)) return;

    setBusyFiscal(true);
    setError(null);
    setMessage(null);

    try {
      await api.post(fiscalEndpoint, {});
      setMessage('Dokumenti u dergua ne workflow te fiskalizimit.');
      router.refresh();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusyFiscal(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Veprimet Operative</h2>
          <p className="text-sm text-slate-500 mt-1">
            Menaxho pagesat, afatet, kreditet dhe fiskalizimin pa dale nga dokumenti.
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Dokumenti</p>
          <p className="text-sm font-semibold text-slate-900">{docNo}</p>
        </div>
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

      {(dueState || remaining <= 0) && documentType !== 'sales-returns' ? (
        <DueStateReminder
          dueState={dueState}
          dueDate={dueDate}
          daysPastDue={daysPastDue}
          outstandingAmount={remaining}
        />
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-500 mb-1">Statusi</p>
          <StatusBadge value={status} />
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-500 mb-1">Totali</p>
          <p className="text-sm font-semibold text-slate-900">{formatMoney(total)} EUR</p>
          {documentType === 'sales-invoices' && credited > 0 ? (
            <p className="text-xs text-slate-400 mt-1">Kredi nga kthimet: {formatMoney(credited)} EUR</p>
          ) : null}
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-500 mb-1">Paguar</p>
          <p className="text-sm font-semibold text-slate-900">{formatMoney(paid)} EUR</p>
          {paymentStatus ? (
            <div className="mt-2">
              <StatusBadge value={paymentStatus} />
            </div>
          ) : null}
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-500 mb-1">Baza per shlyerje</p>
          <p className="text-sm font-semibold text-slate-900">{formatMoney(settlementBase)} EUR</p>
          {settlementStatus ? (
            <div className="mt-2">
              <StatusBadge value={settlementStatus} />
            </div>
          ) : null}
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-500 mb-1">Mbetur</p>
          <p className="text-sm font-semibold text-slate-900">{formatMoney(remaining)} EUR</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {dueState ? <StatusBadge value={dueState} /> : null}
            <span className="text-xs text-slate-400">
              Afati: {formatDateOnly(dueDate) !== '-' ? formatDateOnly(dueDate) : 'nuk eshte caktuar'}
            </span>
          </div>
          {Number(daysPastDue ?? 0) > 0 ? (
            <p className="text-xs text-red-600 mt-2">{daysPastDue} dite ne vonese</p>
          ) : null}
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-500 mb-1">Fiskalizimi</p>
          {fiscalStatus ? (
            <StatusBadge value={fiscalStatus} />
          ) : (
            <span className="text-sm text-slate-400">n/a</span>
          )}
          {fiscalReference ? <p className="text-xs text-slate-500 mt-2">Ref: {fiscalReference}</p> : null}
          {fiscalError ? <p className="text-xs text-red-600 mt-2">{fiscalError}</p> : null}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500 mb-1">Reconciliation</p>
          <div className="flex items-center gap-2">
            <StatusBadge
              value={
                reconciliation.isOverpaid
                  ? 'FAILED'
                  : reconciliation.hasAggregateWithoutHistory || reconciliation.hasMismatch
                    ? 'PENDING'
                    : 'ACCEPTED'
              }
            />
            <span className="text-xs text-slate-500">
              {reconciliation.isOverpaid
                ? 'Pagese mbi bazen e shlyerjes'
                : reconciliation.hasAggregateWithoutHistory
                  ? 'Ka total te paguar pa histori'
                  : reconciliation.hasMismatch
                    ? 'Ka diference ne reconciliation'
                    : 'Historiku perputhet me totalin'}
            </span>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500 mb-1">Totali nga historiku</p>
          <p className="text-sm font-semibold text-slate-900">
            {formatMoney(reconciliation.historyTotal)} EUR
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {reconciliation.transactionCount} regjistrime ne audit trail
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500 mb-1">Delta vs `amountPaid`</p>
          <p
            className={`text-sm font-semibold ${
              Math.abs(reconciliation.delta) < 0.01 ? 'text-emerald-700' : 'text-amber-700'
            }`}
          >
            {formatMoney(reconciliation.delta)} EUR
          </p>
          <p className="text-xs text-slate-400 mt-1">
            0.00 do te thote reconciliation i paster
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500 mb-1">Pagesa e fundit</p>
          {reconciliation.latestPayment ? (
            <>
              <p className="text-sm font-semibold text-slate-900">
                {formatMoney(
                  Number(
                    reconciliation.latestPayment.appliedAmount ??
                      reconciliation.latestPayment.amount ??
                      0,
                  ),
                )}{' '}
                EUR
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {formatDateOnly(reconciliation.latestPayment.paidAt)} |{' '}
                {reconciliation.latestPayment.user?.fullName ??
                  reconciliation.latestPayment.user?.email ??
                  'Pa operator'}
              </p>
              {Number(reconciliation.latestPayment.unappliedAmount ?? 0) > 0 ? (
                <p className="text-xs text-amber-700 mt-1">
                  Unapplied:{' '}
                  {formatMoney(Number(reconciliation.latestPayment.unappliedAmount ?? 0))} EUR
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-slate-400">Nuk ka pagesa te regjistruara</p>
          )}
        </div>
      </div>

      {reconciliation.hasAggregateWithoutHistory ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Dokumenti ka `amountPaid` me vlere {formatMoney(paid)} EUR, por nuk ka histori pagesash ne
          audit trail. Kjo zakonisht tregon data legacy ose hyrje te vjetra jashte workflow-it aktual.
        </div>
      ) : null}

      {reconciliation.hasMismatch ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Totali i historikut te pagesave ({formatMoney(reconciliation.historyTotal)} EUR) nuk
          perputhet me `amountPaid` ({formatMoney(paid)} EUR). Delta aktuale eshte{' '}
          {formatMoney(reconciliation.delta)} EUR dhe duhet kontrolluar para mbylljes se dokumentit.
        </div>
      ) : null}

      {reconciliation.isOverpaid ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          `amountPaid` tejkalon bazen e shlyerjes ({formatMoney(settlementBase)} EUR). Ky eshte sinjal
          i forte per data inconsistency dhe duhet verifikuar menjehere.
        </div>
      ) : null}

      {reconciliation.hasLegacyFallback ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
          Disa pagesa po shfaqen me snapshot fallback, sepse jane regjistruar para se te shtonim
          metadata te plota `before/after`. Historiku vazhdon te lexohet, por entries e reja jane me
          reconciliation me te detajuar.
        </div>
      ) : null}

      {reconciliation.unappliedTotal > 0 ? (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
          Ky dokument ka edhe {formatMoney(reconciliation.unappliedTotal)} EUR te regjistruara si
          `unapplied`. Kjo pjese nuk shtohet te `amountPaid` dhe mbetet per trajtim ose rialokim te
          mevonshem.
          {reallocationHref ? (
            <>
              {' '}
              <Link href={reallocationHref} className="font-medium text-indigo-900 underline">
                Hape faqen e rialokimeve
              </Link>
              .
            </>
          ) : null}
        </div>
      ) : null}

      {canRecordPayment ? (
        <form onSubmit={handlePayment} className="rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Regjistro pagese</h3>
              <p className="text-xs text-slate-500 mt-1">
                Veprimi perditeson `amountPaid`, `paymentStatus` dhe snapshot-in `before/after` ne
                historikun e pagesave.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {dedicatedPaymentHref ? (
                <Link
                  href={dedicatedPaymentHref}
                  className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 hover:text-indigo-900"
                >
                  Hap faqen e dedikuar
                </Link>
              ) : null}
              {paymentActivityHref ? (
                <Link
                  href={paymentActivityHref}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 hover:text-slate-900"
                >
                  Shiko aktivitetin e filtruar
                </Link>
              ) : null}
              {paymentActionBlocked ? (
                <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-1">
                  {status === 'DRAFT' ? 'Postoje dokumentin para pageses' : remaining <= 0 ? 'Dokumenti eshte i shlyer' : 'Veprimi nuk lejohet'}
                </span>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Shuma</span>
              <input
                type="number"
                min={0.01}
                max={!allowUnapplied && remaining > 0 ? remaining : undefined}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                disabled={paymentActionBlocked}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Data</span>
              <input
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                disabled={paymentActionBlocked}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Referenca</span>
              <input
                type="text"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                disabled={paymentActionBlocked}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Shenime</span>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                disabled={paymentActionBlocked}
              />
            </label>
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={allowUnapplied}
              onChange={(event) => setAllowUnapplied(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              disabled={paymentActionBlocked}
            />
            <span>
              Lejo tepricen si `unapplied` nese shuma kalon vleren e mbetur ne kete dokument.
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
                Aktivizo opsionin sipas mesiper nese don ta pranosh tepricen si pagese te papershtatur.
              </p>
            ) : null}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busyPayment || paymentActionBlocked}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busyPayment ? 'Duke regjistruar...' : 'Regjistro pagesen'}
            </button>
          </div>
        </form>
      ) : null}

      {payments.length > 0 ? (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Timeline e Shlyerjes</h3>
              <p className="text-xs text-slate-500 mt-1">
                Gjendja para/pas cdo pagese per reconciliation me te thelle.
              </p>
            </div>
            {paymentActivityHref ? (
              <Link
                href={paymentActivityHref}
                className="text-xs font-medium text-indigo-700 hover:text-indigo-900"
              >
                Hap listen e plote te aktivitetit
              </Link>
            ) : null}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5">#</th>
                  <th className="px-4 py-2.5">Data</th>
                  <th className="px-4 py-2.5">Shuma</th>
                  <th className="px-4 py-2.5">Paguar Para / Pas</th>
                  <th className="px-4 py-2.5">Mbetur Para / Pas</th>
                  <th className="px-4 py-2.5">Statusi</th>
                  <th className="px-4 py-2.5">Referenca / Operatori</th>
                  <th className="px-4 py-2.5">Shenime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {payments.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 text-xs font-mono text-slate-500">
                      #{entry.sequence ?? '-'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      <div className="space-y-1">
                        <p>{formatDateOnly(entry.paidAt)}</p>
                        <p className="text-xs text-slate-400">
                          Audit: {formatDateTime(entry.createdAt)}
                        </p>
                        {entry.usedFallbackSnapshot ? (
                          <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                            legacy snapshot
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-slate-900">
                      <div className="space-y-1">
                        <p>{formatMoney(Number(entry.appliedAmount ?? entry.amount ?? 0))} EUR</p>
                        {Number(entry.unappliedAmount ?? 0) > 0 ? (
                          <>
                            <p className="text-xs text-slate-400">
                              Hyrja: {formatMoney(Number(entry.enteredAmount ?? 0))} EUR
                            </p>
                            <p className="text-xs text-amber-700">
                              Unapplied: {formatMoney(Number(entry.unappliedAmount ?? 0))} EUR
                            </p>
                          </>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      <div className="space-y-1">
                        <p>{formatMoney(Number(entry.amountPaidBefore ?? 0))} EUR</p>
                        <p className="text-xs text-slate-400">
                          Pas: {formatMoney(Number(entry.amountPaidAfter ?? 0))} EUR
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      <div className="space-y-1">
                        <p>{formatMoney(Number(entry.outstandingBefore ?? 0))} EUR</p>
                        <p className="text-xs text-slate-400">
                          Pas: {formatMoney(Number(entry.outstandingAfter ?? entry.remainingAmount ?? 0))} EUR
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {entry.paymentStatusBefore ? <StatusBadge value={entry.paymentStatusBefore} /> : null}
                        <span className="text-xs text-slate-400">to</span>
                        {entry.paymentStatusAfter ? <StatusBadge value={entry.paymentStatusAfter} /> : null}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      <div className="space-y-1">
                        <p>{entry.referenceNo ?? '-'}</p>
                        <p className="text-xs text-slate-400">
                          {entry.user?.fullName ?? entry.user?.email ?? '-'}
                        </p>
                        {entry.isReallocation ? (
                          <span className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                            rialokim
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {entry.notes || entry.sourceDocumentNo ? (
                        <div className="space-y-1">
                          {entry.notes ? <p>{entry.notes}</p> : null}
                          {entry.sourceDocumentNo ? (
                            <p className="text-xs text-indigo-700">
                              Burimi: {entry.sourceDocumentType ?? 'document'} / {entry.sourceDocumentNo}
                            </p>
                          ) : null}
                          {entry.settlementTotal !== undefined && entry.settlementTotal !== null ? (
                            <p className="text-xs text-slate-400">
                              Baza: {formatMoney(Number(entry.settlementTotal ?? 0))} EUR
                            </p>
                          ) : null}
                        </div>
                      ) : entry.settlementTotal !== undefined && entry.settlementTotal !== null ? (
                        <span className="text-xs text-slate-400">
                          Baza: {formatMoney(Number(entry.settlementTotal ?? 0))} EUR
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {canFiscalize && fiscalEndpoint ? (
        <div className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Fiskalizimi</h3>
              <p className="text-xs text-slate-500 mt-1">
                Workflow i kontrolluar me status, reference dhe audit trail.
              </p>
            </div>
            <button
              type="button"
              onClick={handleFiscalization}
              disabled={busyFiscal || status === 'DRAFT' || fiscalStatus === 'ACCEPTED'}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busyFiscal
                ? 'Duke derguar...'
                : fiscalStatus === 'ACCEPTED'
                  ? 'Fiskalizuar'
                  : 'Dergo per fiskalizim'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
