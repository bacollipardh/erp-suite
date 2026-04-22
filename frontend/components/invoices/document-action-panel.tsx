'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { DueStateReminder } from '@/components/finance/due-state-reminder';
import { formatDateOnly, toDateInputValue } from '@/lib/date';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { useSession } from '@/components/session-provider';
import { StatusBadge } from '@/components/status-badge';

type DocumentType = 'sales-invoices' | 'purchase-invoices' | 'sales-returns';

type PaymentEntry = {
  id: string;
  amount: number | string;
  paidAt: string;
  createdAt?: string;
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

  const paymentActionBlocked =
    status === 'DRAFT' || status === 'CANCELLED' || status === 'STORNO' || remaining <= 0;

  const [amount, setAmount] = useState(remaining > 0 ? remaining.toFixed(2) : '');
  const [paidAt, setPaidAt] = useState(toDateInputValue(new Date()));
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');
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

    if (numericAmount > remaining) {
      setBusyPayment(false);
      setError('Shuma e pageses nuk mund te kaloje vleren e mbetur.');
      return;
    }

    try {
      await api.post(`${documentType}/${documentId}/payments`, {
        amount: numericAmount,
        paidAt,
        referenceNo: referenceNo || undefined,
        notes: notes || undefined,
      });

      setAmount('');
      setReferenceNo('');
      setNotes('');
      setMessage('Pagesa u regjistrua me sukses.');
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

      {canRecordPayment ? (
        <form onSubmit={handlePayment} className="rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Regjistro pagese</h3>
              <p className="text-xs text-slate-500 mt-1">
                Veprimi perditeson `amountPaid`, `paymentStatus` dhe historikun e pagesave.
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
                max={remaining > 0 ? remaining : undefined}
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
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <h3 className="text-sm font-semibold text-slate-900">Historiku i Pagesave</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5">Data</th>
                  <th className="px-4 py-2.5">Shuma</th>
                  <th className="px-4 py-2.5">Referenca</th>
                  <th className="px-4 py-2.5">Operatori</th>
                  <th className="px-4 py-2.5">Shenime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {payments.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 text-slate-600">{formatDateOnly(entry.paidAt)}</td>
                    <td className="px-4 py-2.5 font-semibold text-slate-900">
                      {formatMoney(Number(entry.amount ?? 0))} EUR
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{entry.referenceNo ?? '-'}</td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {entry.user?.fullName ?? entry.user?.email ?? '-'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{entry.notes ?? '-'}</td>
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
