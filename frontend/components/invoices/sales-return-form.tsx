'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { SelectInput } from '@/components/crud/select-input';
import { TextInput } from '@/components/crud/text-input';
import { TextareaInput } from '@/components/crud/textarea-input';
import { FormActions } from '@/components/crud/form-actions';
import { InvoiceLineModel, InvoiceLinesEditor } from './invoice-lines-editor';
import { DocumentTotals } from './document-totals';
import { ConfirmButton } from '@/components/confirm-button';

function calcTotals(lines: InvoiceLineModel[]) {
  const normalized = lines.map((line) => {
    const netAmount = Number(line.qty) * Number(line.unitPrice);
    const taxAmount = netAmount * (Number(line.taxPercent) / 100);
    const grossAmount = netAmount + taxAmount;
    return { netAmount, taxAmount, grossAmount };
  });

  const subtotal = normalized.reduce((a, b) => a + b.netAmount, 0);
  const taxTotal = normalized.reduce((a, b) => a + b.taxAmount, 0);
  const grandTotal = normalized.reduce((a, b) => a + b.grossAmount, 0);

  return { subtotal, taxTotal, grandTotal };
}

export function SalesReturnForm({
  mode,
  data,
  series,
  customers,
  salesInvoices,
  items,
}: {
  mode: 'create' | 'edit';
  data?: any;
  series: any[];
  customers: any[];
  salesInvoices: any[];
  items: any[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    seriesId: data?.seriesId ?? '',
    salesInvoiceId: data?.salesInvoiceId ?? '',
    customerId: data?.customerId ?? '',
    docDate: data?.docDate ? String(data.docDate).slice(0, 10) : new Date().toISOString().slice(0, 10),
    reason: data?.reason ?? '',
    notes: data?.notes ?? '',
  });

  const [lines, setLines] = useState<InvoiceLineModel[]>(
    data?.lines?.length
      ? data.lines.map((line: any) => ({
          itemId: line.itemId ?? '',
          salesInvoiceLineId: line.salesInvoiceLineId,
          qty: Number(line.qty),
          unitPrice: Number(line.unitPrice),
          taxPercent: Number(line.taxPercent),
        }))
      : [{ itemId: '', qty: 1, unitPrice: 0, taxPercent: 0 }],
  );

  const totals = useMemo(() => calcTotals(lines), [lines]);
  const [apiError, setApiError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const emptyLine = lines.findIndex((l) => !l.itemId);
    if (emptyLine !== -1) {
      setApiError(`Line ${emptyLine + 1}: please select an item.`);
      return;
    }
    setBusy(true);
    setApiError(null);

    const payload = {
      ...form,
      lines: lines.map((line) => {
        const mapped: Record<string, unknown> = {
          itemId: line.itemId,
          qty: Number(line.qty),
          unitPrice: Number(line.unitPrice),
          taxPercent: Number(line.taxPercent),
        };
        // Only include salesInvoiceLineId when it's a non-empty value
        if (line.salesInvoiceLineId && line.salesInvoiceLineId.trim() !== '') {
          mapped.salesInvoiceLineId = line.salesInvoiceLineId.trim();
        }
        return mapped;
      }),
    };

    try {
      if (mode === 'create') {
        await api.create('sales-returns', payload);
      } else {
        await api.update('sales-returns', data.id, payload);
      }
      router.push('/sales-returns');
      router.refresh();
    } catch (err: any) {
      try { setApiError(JSON.parse(err.message).message ?? err.message); }
      catch { setApiError(err.message ?? 'An error occurred'); }
    } finally {
      setBusy(false);
    }
  }

  async function onPost() {
    setApiError(null);
    try {
      await api.postDocument('sales-returns', data.id);
      router.refresh();
    } catch (err: any) {
      try { setApiError(JSON.parse(err.message).message ?? err.message); }
      catch { setApiError(err.message ?? 'An error occurred'); }
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {apiError && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{apiError}</div>
      )}
      <div className="rounded-2xl border bg-white p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div>
            <SelectInput label="Seria e Dokumentit (numërim)" value={form.seriesId} onChange={(value) => setForm({ ...form, seriesId: value })} options={series.map((x) => ({ value: x.id, label: `${x.prefix} — radhës: ${x.nextNumber}` }))} />
            <p className="text-xs text-slate-400 mt-1">Përcakton numrin e dokumentit (p.sh. SR-2025/0001)</p>
          </div>
          <SelectInput label="Fatura e Shitjes" value={form.salesInvoiceId} onChange={(value) => setForm({ ...form, salesInvoiceId: value })} options={salesInvoices.map((x) => ({ value: x.id, label: x.docNo }))} />
          <SelectInput label="Klienti" value={form.customerId} onChange={(value) => setForm({ ...form, customerId: value })} options={customers.map((x) => ({ value: x.id, label: x.name }))} />
          <TextInput label="Data e Dokumentit" type="date" value={form.docDate} onChange={(e) => setForm({ ...form, docDate: e.target.value })} />
          <TextInput label="Arsyeja" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        </div>
        <TextareaInput label="Shënime" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>

      <div className="rounded-2xl border bg-white p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold">Rreshtat e Kthimit</div>
          <div className="text-xs text-slate-400">Çmimi dhe TVSH plotësohen automatikisht nga artikulli</div>
        </div>
        <InvoiceLinesEditor
          lines={lines}
          setLines={setLines}
          items={items}
          withDiscount={false}
          withSalesInvoiceLineId
          priceField="standardSalesPrice"
        />
      </div>

      <DocumentTotals subtotal={totals.subtotal} taxTotal={totals.taxTotal} grandTotal={totals.grandTotal} />

      <div className="flex items-center justify-between gap-3">
        <div>
          {mode === 'edit' && data?.status === 'DRAFT' ? (
            <ConfirmButton label="Posto Dokumentin" confirmText="Posto këtë kthim shitjeje?" onClick={onPost} className="rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm font-medium" />
          ) : null}
        </div>
        <FormActions submitLabel={mode === 'create' ? 'Krijo Kthim Shitjeje' : 'Përditëso Kthimin e Shitjes'} busy={busy} />
      </div>
    </form>
  );
}
