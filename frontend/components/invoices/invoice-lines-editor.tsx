'use client';

import { NumberInput } from '@/components/crud/number-input';
import { SelectInput } from '@/components/crud/select-input';

export type InvoiceLineModel = {
  itemId: string;
  salesInvoiceLineId?: string;
  qty: number;
  unitPrice: number;
  discountPercent?: number;
  taxPercent: number;
};

export type LineItem = {
  id: string;
  name: string;
  code?: string;
  standardSalesPrice?: number;
  standardPurchasePrice?: number;
  taxRate?: { ratePercent: number };
};

export function InvoiceLinesEditor({
  lines,
  setLines,
  items,
  withDiscount = true,
  withSalesInvoiceLineId = false,
  priceField = 'standardSalesPrice',
}: {
  lines: InvoiceLineModel[];
  setLines: (lines: InvoiceLineModel[]) => void;
  items: LineItem[];
  withDiscount?: boolean;
  withSalesInvoiceLineId?: boolean;
  priceField?: 'standardSalesPrice' | 'standardPurchasePrice';
}) {
  function updateLine(index: number, patch: Partial<InvoiceLineModel>) {
    const next = [...lines];
    next[index] = { ...next[index], ...patch };
    setLines(next);
  }

  function selectItem(index: number, itemId: string) {
    const item = items.find((x) => x.id === itemId);
    updateLine(index, {
      itemId,
      unitPrice: item ? Number(item[priceField] ?? 0) : 0,
      taxPercent: item?.taxRate ? Number(item.taxRate.ratePercent) : 0,
    });
  }

  function addLine() {
    setLines([
      ...lines,
      {
        itemId: '',
        ...(withSalesInvoiceLineId ? { salesInvoiceLineId: '' } : {}),
        qty: 1,
        unitPrice: 0,
        discountPercent: 0,
        taxPercent: 0,
      },
    ]);
  }

  function removeLine(index: number) {
    setLines(lines.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="hidden md:grid grid-cols-12 gap-2 px-1 text-xs font-medium text-slate-500 uppercase tracking-wide">
        <div className="col-span-4">Artikulli</div>
        <div className="col-span-2 text-right">Sasia</div>
        <div className="col-span-2 text-right">Çmimi</div>
        {withDiscount && <div className="col-span-1 text-right">Zb %</div>}
        <div className="col-span-1 text-right">TVSH %</div>
        <div className="col-span-1 text-right">Neto</div>
        <div className="col-span-1" />
      </div>

      {lines.map((line, index) => {
        const grossBase = Number(line.qty) * Number(line.unitPrice);
        const disc = grossBase * (Number(line.discountPercent ?? 0) / 100);
        const net = grossBase - disc;

        return (
          <div key={index} className="grid grid-cols-12 gap-2 items-end border rounded-xl p-3 bg-slate-50">
            {/* Item select */}
            <div className="col-span-12 md:col-span-4">
              <SelectInput
                label=""
                value={line.itemId}
                onChange={(value) => selectItem(index, value)}
                options={items.map((x) => ({
                  value: x.id,
                  label: `${x.code ? `[${x.code}] ` : ''}${x.name}`,
                }))}
              />
              {withSalesInvoiceLineId && line.salesInvoiceLineId && (
                <div className="text-xs text-slate-400 mt-1 truncate">ref: {line.salesInvoiceLineId.slice(0, 8)}…</div>
              )}
            </div>

            {/* Qty */}
            <div className="col-span-4 md:col-span-2">
              <NumberInput
                label=""
                value={line.qty}
                min={0.001}
                step="any"
                onChange={(e) => updateLine(index, { qty: Number(e.target.value) })}
              />
            </div>

            {/* Unit Price */}
            <div className="col-span-4 md:col-span-2">
              <NumberInput
                label=""
                value={line.unitPrice}
                min={0}
                step="any"
                onChange={(e) => updateLine(index, { unitPrice: Number(e.target.value) })}
              />
            </div>

            {/* Discount % */}
            {withDiscount && (
              <div className="col-span-4 md:col-span-1">
                <NumberInput
                  label=""
                  value={line.discountPercent ?? 0}
                  min={0}
                  max={100}
                  step="any"
                  onChange={(e) => updateLine(index, { discountPercent: Number(e.target.value) })}
                />
              </div>
            )}

            {/* Tax % */}
            <div className="col-span-4 md:col-span-1">
              <NumberInput
                label=""
                value={line.taxPercent}
                min={0}
                max={100}
                step="any"
                onChange={(e) => updateLine(index, { taxPercent: Number(e.target.value) })}
              />
            </div>

            {/* Net amount */}
            <div className="col-span-4 md:col-span-1 text-right text-sm font-medium text-slate-700 pb-2">
              {net.toFixed(2)}
            </div>

            {/* Remove */}
            <div className="col-span-4 md:col-span-1 text-right">
              <button
                type="button"
                onClick={() => removeLine(index)}
                className="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded-lg hover:bg-red-50"
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={addLine}
        className="rounded-xl border border-dashed px-4 py-2 text-sm text-slate-500 hover:bg-slate-50 w-full"
      >
        + Shto Rresht
      </button>
    </div>
  );
}
