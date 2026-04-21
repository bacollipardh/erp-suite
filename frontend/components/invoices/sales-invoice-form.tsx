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
    const grossBase = Number(line.qty) * Number(line.unitPrice);
    const disc = grossBase * (Number(line.discountPercent ?? 0) / 100);
    const netAmount = grossBase - disc;
    const taxAmount = netAmount * (Number(line.taxPercent) / 100);
    const grossAmount = netAmount + taxAmount;
    return { discountAmount: disc, netAmount, taxAmount, grossAmount };
  });

  return {
    subtotal: normalized.reduce((a, b) => a + b.netAmount, 0),
    discountTotal: normalized.reduce((a, b) => a + b.discountAmount, 0),
    taxTotal: normalized.reduce((a, b) => a + b.taxAmount, 0),
    grandTotal: normalized.reduce((a, b) => a + b.grossAmount, 0),
  };
}

export function SalesInvoiceForm({
  mode,
  data,
  series,
  customers,
  warehouses,
  paymentMethods,
  items,
}: {
  mode: 'create' | 'edit';
  data?: any;
  series: any[];
  customers: any[];
  warehouses: any[];
  paymentMethods: any[];
  items: any[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const [form, setForm] = useState({
    seriesId: data?.seriesId ?? '',
    customerId: data?.customerId ?? '',
    warehouseId: data?.warehouseId ?? '',
    paymentMethodId: data?.paymentMethodId ?? '',
    docDate: data?.docDate ? String(data.docDate).slice(0, 10) : new Date().toISOString().slice(0, 10),
    notes: data?.notes ?? '',
  });

  const [lines, setLines] = useState<InvoiceLineModel[]>(
    data?.lines?.length
      ? data.lines.map((line: any) => ({
          itemId: line.itemId ?? '',
          qty: Number(line.qty),
          unitPrice: Number(line.unitPrice),
          discountPercent: Number(line.discountPercent ?? 0),
          taxPercent: Number(line.taxPercent),
        }))
      : [{ itemId: '', qty: 1, unitPrice: 0, discountPercent: 0, taxPercent: 0 }],
  );

  const totals = useMemo(() => calcTotals(lines), [lines]);

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
      lines: lines.map(({ itemId, qty, unitPrice, discountPercent, taxPercent }) => ({
        itemId,
        qty,
        unitPrice,
        discountPercent: discountPercent ?? 0,
        taxPercent,
      })),
    };

    try {
      if (mode === 'create') {
        await api.create('sales-invoices', payload);
      } else {
        await api.update('sales-invoices', data.id, payload);
      }
      router.push('/sales-invoices');
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
      await api.postDocument('sales-invoices', data.id);
      router.refresh();
    } catch (err: any) {
      try { setApiError(JSON.parse(err.message).message ?? err.message); }
      catch { setApiError(err.message ?? 'An error occurred'); }
    }
  }

  const isPosted = data?.status === 'POSTED';

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {apiError && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2.5">{apiError}</div>
      )}

      {isPosted && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm px-3 py-2.5">
          ⚠️ Kjo faturë është <strong>Postuar</strong> dhe nuk mund të modifikohet.
        </div>
      )}

      {/* ── Header card ─────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Detajet e Dokumentit</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <SelectInput
              label="Seria *"
              value={form.seriesId}
              onChange={(value) => setForm({ ...form, seriesId: value })}
              options={series.map((x) => ({ value: x.id, label: `${x.prefix} · #${x.nextNumber}` }))}
            />
          </div>
          <SelectInput label="Klienti" value={form.customerId}
            onChange={(v) => setForm({ ...form, customerId: v })}
            options={customers.map((x) => ({ value: x.id, label: x.name }))} />
          <SelectInput label="Magazina *" value={form.warehouseId}
            onChange={(v) => setForm({ ...form, warehouseId: v })}
            options={warehouses.map((x) => ({ value: x.id, label: x.name }))} />
          <SelectInput label="Pagesa" value={form.paymentMethodId}
            onChange={(v) => setForm({ ...form, paymentMethodId: v })}
            options={paymentMethods.map((x) => ({ value: x.id, label: x.name }))} />
          <TextInput label="Data" type="date" value={form.docDate}
            onChange={(e) => setForm({ ...form, docDate: e.target.value })} />
        </div>
        <div className="mt-3">
          <TextareaInput label="Shënime" value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </div>

      {/* ── Lines card ──────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Rreshtat e Faturës</span>
          <span className="text-xs text-slate-400">Çmimi dhe TVSH plotësohen automatikisht</span>
        </div>
        <div className="p-4">
          <InvoiceLinesEditor
            lines={lines}
            setLines={setLines}
            items={items}
            withDiscount
            priceField="standardSalesPrice"
          />
        </div>
      </div>

      <DocumentTotals {...totals} />

      <div className="flex items-center justify-between gap-3 pt-1">
        <div>
          {mode === 'edit' && data?.status === 'DRAFT' && (
            <ConfirmButton
              label="Posto Dokumentin"
              confirmText="Posto këtë faturë shitjeje?"
              onClick={onPost}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm font-medium transition-colors shadow-sm"
            />
          )}
        </div>
        {!isPosted && (
          <FormActions
            submitLabel={mode === 'create' ? 'Krijo Faturë Shitjeje' : 'Përditëso Faturën'}
            busy={busy}
          />
        )}
      </div>
    </form>
  );
}
