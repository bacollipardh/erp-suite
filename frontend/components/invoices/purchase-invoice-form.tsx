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
    const discountAmount = grossBase * (Number(line.discountPercent ?? 0) / 100);
    const netAmount = grossBase - discountAmount;
    const taxAmount = netAmount * (Number(line.taxPercent) / 100);
    const grossAmount = netAmount + taxAmount;

    return { discountAmount, netAmount, taxAmount, grossAmount };
  });

  return {
    subtotal: normalized.reduce((total, line) => total + line.netAmount, 0),
    discountTotal: normalized.reduce((total, line) => total + line.discountAmount, 0),
    taxTotal: normalized.reduce((total, line) => total + line.taxAmount, 0),
    grandTotal: normalized.reduce((total, line) => total + line.grossAmount, 0),
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

  return 'Ndodhi nje gabim.';
}

export function PurchaseInvoiceForm({
  mode,
  data,
  series,
  suppliers,
  warehouses,
  items,
}: {
  mode: 'create' | 'edit';
  data?: any;
  series: any[];
  suppliers: any[];
  warehouses: any[];
  items: any[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const [form, setForm] = useState({
    seriesId: data?.seriesId ?? '',
    supplierId: data?.supplierId ?? '',
    warehouseId: data?.warehouseId ?? '',
    supplierInvoiceNo: data?.supplierInvoiceNo ?? '',
    docDate: data?.docDate ? String(data.docDate).slice(0, 10) : new Date().toISOString().slice(0, 10),
    dueDate: data?.dueDate ? String(data.dueDate).slice(0, 10) : '',
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

    const emptyLine = lines.findIndex((line) => !line.itemId);
    if (emptyLine !== -1) {
      setApiError(`Line ${emptyLine + 1}: please select an item.`);
      return;
    }

    setBusy(true);
    setApiError(null);

    const payload = {
      ...form,
      dueDate: form.dueDate || undefined,
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
        await api.create('purchase-invoices', payload);
      } else {
        await api.update('purchase-invoices', data.id, payload);
      }

      router.push('/purchase-invoices');
      router.refresh();
    } catch (error) {
      setApiError(parseApiError(error));
    } finally {
      setBusy(false);
    }
  }

  async function onPost() {
    setApiError(null);

    try {
      await api.postDocument('purchase-invoices', data.id);
      router.refresh();
    } catch (error) {
      setApiError(parseApiError(error));
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {apiError ? (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          {apiError}
        </div>
      ) : null}

      <div className="rounded-2xl border bg-white p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div>
            <SelectInput
              label="Seria e Dokumentit"
              value={form.seriesId}
              onChange={(value) => setForm({ ...form, seriesId: value })}
              options={series.map((entry) => ({
                value: entry.id,
                label: `${entry.prefix} - radhes: ${entry.nextNumber}`,
              }))}
            />
            <p className="text-xs text-slate-400 mt-1">
              Përcakton formatin e numerimit te dokumentit.
            </p>
          </div>
          <SelectInput
            label="Furnitori *"
            value={form.supplierId}
            onChange={(value) => setForm({ ...form, supplierId: value })}
            options={suppliers.map((entry) => ({ value: entry.id, label: entry.name }))}
          />
          <SelectInput
            label="Magazina *"
            value={form.warehouseId}
            onChange={(value) => setForm({ ...form, warehouseId: value })}
            options={warehouses.map((entry) => ({ value: entry.id, label: entry.name }))}
          />
          <TextInput
            label="Nr. Fatures se Furnitorit"
            value={form.supplierInvoiceNo}
            onChange={(e) => setForm({ ...form, supplierInvoiceNo: e.target.value })}
          />
          <TextInput
            label="Data e Dokumentit"
            type="date"
            value={form.docDate}
            onChange={(e) => setForm({ ...form, docDate: e.target.value })}
          />
          <TextInput
            label="Afati i Pageses"
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
          />
        </div>
        <TextareaInput
          label="Shenime"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </div>

      <div className="rounded-2xl border bg-white p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold">Rreshtat e Fatures</div>
          <div className="text-xs text-slate-400">
            Cmimi dhe TVSH plotesohen automatikisht nga artikulli
          </div>
        </div>
        <InvoiceLinesEditor
          lines={lines}
          setLines={setLines}
          items={items}
          withDiscount
          priceField="standardPurchasePrice"
        />
      </div>

      <DocumentTotals {...totals} />

      <div className="flex items-center justify-between gap-3">
        <div>
          {mode === 'edit' && data?.status === 'DRAFT' ? (
            <ConfirmButton
              label="Posto Dokumentin"
              confirmText="Posto kete fature blerjeje?"
              onClick={onPost}
              className="rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm font-medium"
            />
          ) : null}
        </div>
        <FormActions
          submitLabel={mode === 'create' ? 'Krijo Fature Blerjeje' : 'Perditeso Faturen e Blerjes'}
          busy={busy}
        />
      </div>
    </form>
  );
}
