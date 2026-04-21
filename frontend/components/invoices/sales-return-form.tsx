'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { SelectInput } from '@/components/crud/select-input';
import { TextInput } from '@/components/crud/text-input';
import { TextareaInput } from '@/components/crud/textarea-input';
import { FormActions } from '@/components/crud/form-actions';
import { InvoiceLineModel, InvoiceLinesEditor, SourceInvoiceLine } from './invoice-lines-editor';
import { DocumentTotals } from './document-totals';
import { ConfirmButton } from '@/components/confirm-button';

function calcTotals(lines: InvoiceLineModel[]) {
  const normalized = lines.map((line) => {
    const netAmount = Number(line.qty) * Number(line.unitPrice);
    const taxAmount = netAmount * (Number(line.taxPercent) / 100);
    const grossAmount = netAmount + taxAmount;
    return { netAmount, taxAmount, grossAmount };
  });

  return {
    subtotal: normalized.reduce((total, line) => total + line.netAmount, 0),
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
  const [apiError, setApiError] = useState<string | null>(null);
  const [sourceLines, setSourceLines] = useState<SourceInvoiceLine[]>([]);

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
          salesInvoiceLineId: line.salesInvoiceLineId ?? '',
          qty: Number(line.qty),
          unitPrice: Number(line.unitPrice),
          taxPercent: Number(line.taxPercent),
        }))
      : [{ itemId: '', salesInvoiceLineId: '', qty: 1, unitPrice: 0, taxPercent: 0 }],
  );

  const totals = useMemo(() => calcTotals(lines), [lines]);

  useEffect(() => {
    let active = true;

    async function loadSourceInvoice() {
      if (!form.salesInvoiceId) {
        if (active) {
          setSourceLines([]);
          setLines((current) =>
            current.map((line) => ({
              ...line,
              itemId: '',
              salesInvoiceLineId: '',
              unitPrice: 0,
              taxPercent: 0,
            })),
          );
        }
        return;
      }

      try {
        const invoice = await api.get('sales-invoices', form.salesInvoiceId);
        if (!active) return;

        const nextSourceLines = (invoice.lines ?? []).map((line: any) => ({
          id: line.id,
          itemId: line.itemId,
          qty: Number(line.qty),
          unitPrice: Number(line.unitPrice),
          taxPercent: Number(line.taxPercent),
          item: line.item
            ? { id: line.item.id, name: line.item.name, code: line.item.code }
            : null,
        }));

        setSourceLines(nextSourceLines);
        setLines((current) =>
          current.map((line) => {
            const matchedSourceLine =
              nextSourceLines.find((sourceLine) => sourceLine.id === line.salesInvoiceLineId) ??
              nextSourceLines.find((sourceLine) => sourceLine.itemId === line.itemId);

            if (!matchedSourceLine) {
              return {
                ...line,
                itemId: '',
                salesInvoiceLineId: '',
                unitPrice: 0,
                taxPercent: 0,
              };
            }

            return {
              ...line,
              itemId: matchedSourceLine.itemId,
              salesInvoiceLineId: matchedSourceLine.id,
              unitPrice: Number(matchedSourceLine.unitPrice),
              taxPercent: Number(matchedSourceLine.taxPercent),
            };
          }),
        );

        if (invoice.customerId && invoice.customerId !== form.customerId) {
          setForm((current) => ({ ...current, customerId: invoice.customerId }));
        }
      } catch (error) {
        if (active) {
          setApiError(parseApiError(error));
        }
      }
    }

    void loadSourceInvoice();

    return () => {
      active = false;
    };
  }, [form.salesInvoiceId, form.customerId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();

    if (!form.seriesId) {
      setApiError('Zgjidh serine e dokumentit.');
      return;
    }

    if (!form.salesInvoiceId) {
      setApiError('Zgjidh faturen burim te shitjes.');
      return;
    }

    if (!form.customerId) {
      setApiError('Zgjidh klientin.');
      return;
    }

    const emptyLine = lines.findIndex((line) => !line.itemId);
    if (emptyLine !== -1) {
      setApiError(`Rreshti ${emptyLine + 1}: zgjidh artikullin.`);
      return;
    }

    const missingSourceLine = lines.findIndex((line) => !line.salesInvoiceLineId);
    if (missingSourceLine !== -1) {
      setApiError(`Rreshti ${missingSourceLine + 1}: zgjidh rreshtin burim.`);
      return;
    }

    setBusy(true);
    setApiError(null);

    const payload = {
      ...form,
      lines: lines.map((line) => ({
        salesInvoiceLineId: line.salesInvoiceLineId,
        itemId: line.itemId,
        qty: Number(line.qty),
        unitPrice: Number(line.unitPrice),
        taxPercent: Number(line.taxPercent),
      })),
    };

    try {
      if (mode === 'create') {
        await api.create('sales-returns', payload);
      } else {
        await api.update('sales-returns', data.id, payload);
      }

      router.push('/sales-returns');
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
      await api.postDocument('sales-returns', data.id);
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
            <p className="text-xs text-slate-400 mt-1">Percakton numerimin e kthimit.</p>
          </div>
          <SelectInput
            label="Fatura e Shitjes *"
            value={form.salesInvoiceId}
            onChange={(value) => setForm({ ...form, salesInvoiceId: value })}
            options={salesInvoices.map((entry) => ({ value: entry.id, label: entry.docNo }))}
          />
          <SelectInput
            label="Klienti *"
            value={form.customerId}
            onChange={(value) => setForm({ ...form, customerId: value })}
            options={customers.map((entry) => ({ value: entry.id, label: entry.name }))}
          />
          <TextInput
            label="Data e Dokumentit"
            type="date"
            value={form.docDate}
            onChange={(e) => setForm({ ...form, docDate: e.target.value })}
          />
          <TextInput
            label="Arsyeja"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
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
          <div className="text-base font-semibold">Rreshtat e Kthimit</div>
          <div className="text-xs text-slate-400">
            Zgjidh rreshtin burim nga fatura shitese per cdo artikull.
          </div>
        </div>
        <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-500">
          Cmimi dhe TVSH merren automatikisht nga rreshti burim i fatures se shitjes.
        </div>
        <InvoiceLinesEditor
          lines={lines}
          setLines={setLines}
          items={items}
          sourceLines={sourceLines}
          withDiscount={false}
          withSalesInvoiceLineId
          priceField="standardSalesPrice"
        />
      </div>

      <DocumentTotals
        subtotal={totals.subtotal}
        taxTotal={totals.taxTotal}
        grandTotal={totals.grandTotal}
      />

      <div className="flex items-center justify-between gap-3">
        <div>
          {mode === 'edit' && data?.status === 'DRAFT' ? (
            <ConfirmButton
              label="Posto Dokumentin"
              confirmText="Posto kete kthim shitjeje?"
              onClick={onPost}
              className="rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm font-medium"
            />
          ) : null}
        </div>
        <FormActions
          submitLabel={mode === 'create' ? 'Krijo Kthim Shitjeje' : 'Perditeso Kthimin e Shitjes'}
          busy={busy}
        />
      </div>
    </form>
  );
}
