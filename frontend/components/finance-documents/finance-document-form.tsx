'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

type Option = { id: string; name?: string; code?: string; accountType?: string };

function label(option: Option) {
  const code = option.code ? `${option.code} — ` : '';
  const type = option.accountType ? ` (${option.accountType})` : '';
  return `${code}${option.name ?? option.id}${type}`;
}

export function FinanceDocumentForm({
  type,
  endpoint,
  backHref,
  parties,
  financeAccounts,
}: {
  type: 'customer-receipt' | 'supplier-payment';
  endpoint: string;
  backHref: string;
  parties: Option[];
  financeAccounts: Option[];
}) {
  const router = useRouter();
  const [partyId, setPartyId] = useState(parties[0]?.id ?? '');
  const [financeAccountId, setFinanceAccountId] = useState(financeAccounts[0]?.id ?? '');
  const [docDate, setDocDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isReceipt = type === 'customer-receipt';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');

    try {
      const payload = {
        [isReceipt ? 'customerId' : 'supplierId']: partyId,
        financeAccountId,
        docDate,
        amount: Number(amount),
        referenceNo: referenceNo.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      await api.create(endpoint, payload);
      router.push(backHref);
      router.refresh();
    } catch (err: any) {
      setError(typeof err?.message === 'string' ? err.message : 'Ruajtja deshtoi');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-3xl rounded-xl border bg-white p-5 shadow-sm space-y-4">
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">{isReceipt ? 'Klienti' : 'Furnitori'}</span>
          <select
            required
            value={partyId}
            onChange={(e) => setPartyId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            {parties.map((option) => <option key={option.id} value={option.id}>{label(option)}</option>)}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">Llogaria Cash / Bank</span>
          <select
            required
            value={financeAccountId}
            onChange={(e) => setFinanceAccountId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            {financeAccounts.map((option) => <option key={option.id} value={option.id}>{label(option)}</option>)}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">Data</span>
          <input
            required
            type="date"
            value={docDate}
            onChange={(e) => setDocDate(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">Shuma</span>
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            placeholder="0.00"
          />
        </label>

        <label className="space-y-1 text-sm md:col-span-2">
          <span className="font-medium text-slate-700">Reference</span>
          <input
            value={referenceNo}
            onChange={(e) => setReferenceNo(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            placeholder="p.sh. transfer bankar, nr. kuponi, reference"
          />
        </label>

        <label className="space-y-1 text-sm md:col-span-2">
          <span className="font-medium text-slate-700">Shenime</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            placeholder="Shenime opsionale"
          />
        </label>
      </div>

      <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
        Faza 1: dokumenti krijohet si draft pa alokim ne fature. Kur e poston, shuma ruhet si unapplied / advance per klientin ose furnitorin.
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={busy || !partyId || !financeAccountId}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {busy ? 'Duke ruajtur...' : 'Ruaj Draft'}
        </button>
        <button
          type="button"
          onClick={() => router.push(backHref)}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Anulo
        </button>
      </div>
    </form>
  );
}
