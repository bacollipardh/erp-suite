'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { useSession } from '@/components/session-provider';
import { StatusBadge } from '@/components/status-badge';

type DocumentType = 'sales-invoices' | 'purchase-invoices' | 'sales-returns';

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
  paymentStatus,
  dueDate,
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
  paymentStatus?: string | null;
  dueDate?: string | null;
  fiscalStatus?: string | null;
  fiscalReference?: string | null;
  fiscalError?: string | null;
}) {
  const router = useRouter();
  const { user } = useSession();

  const total = Number(grandTotal ?? 0);
  const paid = Number(amountPaid ?? 0);
  const remaining = Math.max(0, total - paid);

  const canRecordPayment =
    (documentType === 'sales-invoices' &&
      hasPermission(user?.permissions, PERMISSIONS.salesInvoicesPay)) ||
    (documentType === 'purchase-invoices' &&
      hasPermission(user?.permissions, PERMISSIONS.purchaseInvoicesPay));

  const canFiscalize =
    (documentType === 'sales-invoices' || documentType === 'sales-returns') &&
    hasPermission(user?.permissions, PERMISSIONS.fiscalize);

  const [amount, setAmount] = useState(remaining > 0 ? remaining.toFixed(2) : '');
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
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

    try {
      await api.post(`${documentType}/${documentId}/payments`, {
        amount: Number(amount),
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
            Menaxho pagesat, afatet dhe fiskalizimin pa dale nga dokumenti.
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-500 mb-1">Statusi</p>
          <StatusBadge value={status} />
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-500 mb-1">Totali</p>
          <p className="text-sm font-semibold text-slate-900">{formatMoney(total)} EUR</p>
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
          <p className="text-xs text-slate-500 mb-1">Mbetur</p>
          <p className="text-sm font-semibold text-slate-900">{formatMoney(remaining)} EUR</p>
          <p className="text-xs text-slate-400 mt-1">
            Afati: {dueDate ? String(dueDate).slice(0, 10) : 'nuk eshte caktuar'}
          </p>
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
                Veprimi perditeson `amountPaid` dhe `paymentStatus`.
              </p>
            </div>
            {status === 'DRAFT' ? (
              <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-1">
                Postoje dokumentin para pageses
              </span>
            ) : null}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Shuma</span>
              <input
                type="number"
                min={0.01}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                disabled={status === 'DRAFT' || remaining <= 0}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Data</span>
              <input
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                disabled={status === 'DRAFT' || remaining <= 0}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Referenca</span>
              <input
                type="text"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                disabled={status === 'DRAFT' || remaining <= 0}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Shenime</span>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                disabled={status === 'DRAFT' || remaining <= 0}
              />
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busyPayment || status === 'DRAFT' || remaining <= 0}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busyPayment ? 'Duke regjistruar...' : 'Regjistro pagesen'}
            </button>
          </div>
        </form>
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
