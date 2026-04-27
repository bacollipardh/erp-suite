'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

type Option = { id: string; name?: string; code?: string; accountType?: string };
type OpenInvoice = {
  id: string;
  docNo: string;
  docDate?: string;
  dueDate?: string | null;
  customerId?: string;
  supplierId?: string;
  grandTotal?: number;
  amountPaid?: number;
  outstandingAmount?: number;
  paymentStatus?: string;
  settlementStatus?: string;
};

type AllocationState = Record<string, string>;

function label(option: Option) {
  const code = option.code ? `${option.code} — ` : '';
  const type = option.accountType ? ` (${option.accountType})` : '';
  return `${code}${option.name ?? option.id}${type}`;
}

function money(value: number) {
  return new Intl.NumberFormat('sq-XK', { style: 'currency', currency: 'EUR' }).format(Number(value ?? 0));
}

function date(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('sq-XK') : '-';
}

function openAmount(invoice: OpenInvoice) {
  return Number(invoice.outstandingAmount ?? 0);
}

export function FinanceDocumentForm({
  type,
  endpoint,
  backHref,
  parties,
  financeAccounts,
  invoices = [],
}: {
  type: 'customer-receipt' | 'supplier-payment';
  endpoint: string;
  backHref: string;
  parties: Option[];
  financeAccounts: Option[];
  invoices?: OpenInvoice[];
}) {
  const router = useRouter();
  const [partyId, setPartyId] = useState(parties[0]?.id ?? '');
  const [financeAccountId, setFinanceAccountId] = useState(financeAccounts[0]?.id ?? '');
  const [docDate, setDocDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');
  const [allocations, setAllocations] = useState<AllocationState>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isReceipt = type === 'customer-receipt';

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const belongs = isReceipt ? invoice.customerId === partyId : invoice.supplierId === partyId;
      return belongs && openAmount(invoice) > 0;
    });
  }, [invoices, isReceipt, partyId]);

  const allocationRows = useMemo(() => {
    return Object.entries(allocations)
      .map(([invoiceId, rawAmount]) => ({ invoiceId, amount: Number(rawAmount) }))
      .filter((row) => Number.isFinite(row.amount) && row.amount > 0);
  }, [allocations]);

  const allocatedTotal = useMemo(() => allocationRows.reduce((sum, row) => sum + row.amount, 0), [allocationRows]);
  const enteredAmount = amount ? Number(amount) : allocatedTotal;
  const unappliedAmount = Math.max(0, Number(enteredAmount || 0) - allocatedTotal);

  function updateAllocation(invoice: OpenInvoice, value: string) {
    const numeric = Number(value);
    const capped = value === '' ? '' : String(Math.min(Math.max(numeric, 0), openAmount(invoice)));
    setAllocations((prev) => ({ ...prev, [invoice.id]: capped }));
  }

  function applyFull(invoice: OpenInvoice) {
    setAllocations((prev) => ({ ...prev, [invoice.id]: String(openAmount(invoice)) }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');

    try {
      if (!Number.isFinite(enteredAmount) || enteredAmount <= 0) {
        throw new Error('Shuma duhet te jete me e madhe se zero');
      }
      if (allocatedTotal > enteredAmount) {
        throw new Error('Alokimi nuk mund te jete me i madh se shuma e dokumentit');
      }

      const payload: any = {
        [isReceipt ? 'customerId' : 'supplierId']: partyId,
        financeAccountId,
        docDate,
        amount: Number(enteredAmount.toFixed(2)),
        referenceNo: referenceNo.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      if (allocationRows.length) {
        payload.allocations = allocationRows.map((row) => ({
          [isReceipt ? 'salesInvoiceId' : 'purchaseInvoiceId']: row.invoiceId,
          amount: Number(row.amount.toFixed(2)),
        }));
      }

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
    <form onSubmit={submit} className="max-w-5xl rounded-xl border bg-white p-5 shadow-sm space-y-5">
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">{isReceipt ? 'Klienti' : 'Furnitori'}</span>
          <select
            required
            value={partyId}
            onChange={(e) => {
              setPartyId(e.target.value);
              setAllocations({});
            }}
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
          <input required type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
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
            placeholder={allocatedTotal > 0 ? String(allocatedTotal.toFixed(2)) : '0.00'}
          />
          <span className="text-xs text-slate-500">Nëse e lë bosh, merret totali i alokimeve.</span>
        </label>

        <label className="space-y-1 text-sm md:col-span-2">
          <span className="font-medium text-slate-700">Reference</span>
          <input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="p.sh. transfer bankar, nr. kuponi, reference" />
        </label>

        <label className="space-y-1 text-sm md:col-span-2">
          <span className="font-medium text-slate-700">Shenime</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="Shenime opsionale" />
        </label>
      </div>

      <div className="rounded-xl border bg-slate-50/70 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Alokimi në fatura</h3>
            <p className="text-xs text-slate-500">Zgjedh faturat e hapura dhe shumën që do aplikohet.</p>
          </div>
          <div className="text-right text-xs text-slate-600">
            <div>Aplikuar: <strong>{money(allocatedTotal)}</strong></div>
            <div>Pa aplikuar: <strong>{money(unappliedAmount)}</strong></div>
          </div>
        </div>

        {filteredInvoices.length === 0 ? (
          <div className="rounded-lg bg-white border px-3 py-4 text-sm text-slate-500">Nuk ka fatura të hapura për këtë palë. Dokumenti mund të ruhet si advance/unapplied.</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  {['Fatura', 'Data', 'Totali', 'Paguar', 'Hapur', 'Aloko'].map((title) => <th key={title} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="px-3 py-2 font-medium text-slate-900">{invoice.docNo}</td>
                    <td className="px-3 py-2 text-slate-600">{date(invoice.docDate)}</td>
                    <td className="px-3 py-2 text-slate-600">{money(Number(invoice.grandTotal ?? 0))}</td>
                    <td className="px-3 py-2 text-slate-600">{money(Number(invoice.amountPaid ?? 0))}</td>
                    <td className="px-3 py-2 text-slate-900 font-medium">{money(openAmount(invoice))}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max={openAmount(invoice)}
                          step="0.01"
                          value={allocations[invoice.id] ?? ''}
                          onChange={(e) => updateAllocation(invoice, e.target.value)}
                          className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                          placeholder="0.00"
                        />
                        <button type="button" onClick={() => applyFull(invoice)} className="rounded-md border px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">Full</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800">
        Nëse alokon në faturë, postimi do e rrisë paid amount dhe do ndryshojë statusin në PARTIALLY_PAID ose PAID. Teprica ruhet si unapplied/advance.
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={busy || !partyId || !financeAccountId} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          {busy ? 'Duke ruajtur...' : 'Ruaj Draft'}
        </button>
        <button type="button" onClick={() => router.push(backHref)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">Anulo</button>
      </div>
    </form>
  );
}
