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

export type SourceInvoiceLine = {
  id: string;
  itemId: string;
  qty: number;
  unitPrice: number;
  taxPercent: number;
  item?: { id: string; name: string; code?: string } | null;
};

export function InvoiceLinesEditor({
  lines,
  setLines,
  items,
  sourceLines = [],
  withDiscount = true,
  withSalesInvoiceLineId = false,
  priceField = 'standardSalesPrice',
}: {
  lines: InvoiceLineModel[];
  setLines: (lines: InvoiceLineModel[]) => void;
  items: LineItem[];
  sourceLines?: SourceInvoiceLine[];
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
    const item = items.find((entry) => entry.id === itemId);
    const firstSourceLine = sourceLines.find((entry) => entry.itemId === itemId);

    updateLine(index, {
      itemId,
      ...(withSalesInvoiceLineId ? { salesInvoiceLineId: firstSourceLine?.id ?? '' } : {}),
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
    setLines(lines.filter((_, currentIndex) => currentIndex !== index));
  }

  return (
    <div className="space-y-3">
      <div className="hidden md:grid grid-cols-12 gap-2 px-1 text-xs font-medium text-slate-500 uppercase tracking-wide">
        <div className="col-span-4">Artikulli</div>
        <div className="col-span-2 text-right">Sasia</div>
        <div className="col-span-2 text-right">Cmimi</div>
        {withDiscount ? <div className="col-span-1 text-right">Zbritja %</div> : null}
        <div className="col-span-1 text-right">TVSH %</div>
        <div className="col-span-1 text-right">Neto</div>
        <div className="col-span-1" />
      </div>

      {lines.map((line, index) => {
        const grossBase = Number(line.qty) * Number(line.unitPrice);
        const discountAmount = grossBase * (Number(line.discountPercent ?? 0) / 100);
        const net = grossBase - discountAmount;
        const sourceLineOptions = sourceLines
          .filter((sourceLine) => !line.itemId || sourceLine.itemId === line.itemId)
          .map((sourceLine) => ({
            value: sourceLine.id,
            label: `${sourceLine.item?.name ?? sourceLine.itemId} · qty ${sourceLine.qty}`,
          }));

        return (
          <div key={index} className="grid grid-cols-12 gap-2 items-end border rounded-xl p-3 bg-slate-50">
            <div className="col-span-12 md:col-span-4">
              <SelectInput
                label=""
                value={line.itemId}
                onChange={(value) => selectItem(index, value)}
                options={items.map((entry) => ({
                  value: entry.id,
                  label: `${entry.code ? `[${entry.code}] ` : ''}${entry.name}`,
                }))}
              />
              {withSalesInvoiceLineId ? (
                <div className="mt-2">
                  <SelectInput
                    label="Rreshti burim"
                    value={line.salesInvoiceLineId ?? ''}
                    onChange={(value) => updateLine(index, { salesInvoiceLineId: value })}
                    options={sourceLineOptions}
                  />
                </div>
              ) : null}
            </div>

            <div className="col-span-4 md:col-span-2">
              <NumberInput
                label=""
                value={line.qty}
                min={0.001}
                step="any"
                onChange={(e) => updateLine(index, { qty: Number(e.target.value) })}
              />
            </div>

            <div className="col-span-4 md:col-span-2">
              <NumberInput
                label=""
                value={line.unitPrice}
                min={0}
                step="any"
                onChange={(e) => updateLine(index, { unitPrice: Number(e.target.value) })}
              />
            </div>

            {withDiscount ? (
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
            ) : null}

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

            <div className="col-span-4 md:col-span-1 text-right text-sm font-medium text-slate-700 pb-2">
              {net.toFixed(2)}
            </div>

            <div className="col-span-4 md:col-span-1 text-right">
              <button
                type="button"
                onClick={() => removeLine(index)}
                className="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded-lg hover:bg-red-50"
              >
                X
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
