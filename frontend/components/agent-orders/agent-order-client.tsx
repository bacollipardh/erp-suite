'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/status-badge';

type Option = {
  id: string;
  code?: string | null;
  name?: string | null;
  fullName?: string | null;
  email?: string | null;
};

type AgentLine = {
  itemId: string;
  salesInvoiceLineId?: string;
  description?: string;
  qty: number;
  unitPrice: number;
  discountPercent: number;
  taxPercent: number;
  notes?: string;
};

type ReturnSource = {
  id: string;
  docNo: string;
  customerId: string;
  customer?: { name?: string | null } | null;
  warehouse?: { name?: string | null } | null;
  lines: Array<{
    id: string;
    itemId: string;
    qty: number | string;
    unitPrice: number | string;
    taxPercent: number | string;
    item?: { code?: string | null; name?: string | null } | null;
  }>;
};

const ORDER_TYPES = [
  { value: 'SALES_ORDER', label: 'Order shitje' },
  { value: 'RETURN_ORDER', label: 'Order kthimi' },
  { value: 'OPEN_RETURN_ORDER', label: 'Kthim pa afat' },
  { value: 'EXCHANGE_ORDER', label: 'Order nderrimi' },
];

function optionLabel(entry: Option) {
  return `${entry.code ? `${entry.code} - ` : ''}${entry.name ?? entry.fullName ?? entry.email ?? entry.id}`;
}

function parseApiError(error: unknown) {
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message);
      if (Array.isArray(parsed.message)) return parsed.message.join(', ');
      if (typeof parsed.message === 'string') return parsed.message;
    } catch {}
    return error.message;
  }
  return 'Veprimi deshtoi.';
}

function Message({
  error,
  message,
}: {
  error?: string | null;
  message?: string | null;
}) {
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </div>
    );
  }
  if (message) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
        {message}
      </div>
    );
  }
  return null;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function AgentOrderForm({
  customers,
  customerObjects,
  warehouses,
  items,
  returnSources,
  data,
}: {
  customers: Option[];
  customerObjects: Array<Option & { customerId: string; isActive?: boolean }>;
  warehouses: Option[];
  items: Array<
    Option & {
      standardSalesPrice?: number | string | null;
      taxRate?: { rate?: number | string | null } | null;
    }
  >;
  returnSources: ReturnSource[];
  data?: any;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    orderType: data?.orderType ?? 'SALES_ORDER',
    customerId: data?.customerId ?? '',
    customerObjectId: data?.customerObjectId ?? '',
    warehouseId: data?.warehouseId ?? '',
    sourceSalesInvoiceId: data?.sourceSalesInvoiceId ?? '',
    docDate: data?.docDate ? String(data.docDate).slice(0, 10) : today(),
    dueDate: data?.dueDate ? String(data.dueDate).slice(0, 10) : '',
    priority: data?.priority ?? 5,
    notes: data?.notes ?? '',
  });
  const [lines, setLines] = useState<AgentLine[]>(
    data?.lines?.length
      ? data.lines.map((line: any) => ({
          itemId: line.itemId,
          salesInvoiceLineId: line.salesInvoiceLineId ?? '',
          description: line.description ?? '',
          qty: Number(line.qty),
          unitPrice: Number(line.unitPrice),
          discountPercent: Number(line.discountPercent ?? 0),
          taxPercent: Number(line.taxPercent ?? 0),
          notes: line.notes ?? '',
        }))
      : [
          {
            itemId: '',
            qty: 1,
            unitPrice: 0,
            discountPercent: 0,
            taxPercent: 18,
          },
        ],
  );

  const visibleObjects = customerObjects.filter(
    (entry) => !form.customerId || entry.customerId === form.customerId,
  );
  const source = returnSources.find(
    (entry) => entry.id === form.sourceSalesInvoiceId,
  );
  const sourceLines = source?.lines ?? [];
  const isReturn =
    form.orderType === 'RETURN_ORDER' || form.orderType === 'OPEN_RETURN_ORDER';

  const totals = useMemo(() => {
    return lines.reduce(
      (acc, line) => {
        const base = Number(line.qty || 0) * Number(line.unitPrice || 0);
        const discount = base * (Number(line.discountPercent || 0) / 100);
        const net = base - discount;
        const tax = net * (Number(line.taxPercent || 0) / 100);
        return {
          net: acc.net + net,
          tax: acc.tax + tax,
          total: acc.total + net + tax,
        };
      },
      { net: 0, tax: 0, total: 0 },
    );
  }, [lines]);

  function updateLine(index: number, patch: Partial<AgentLine>) {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  function chooseItem(index: number, itemId: string) {
    const item = items.find((entry) => entry.id === itemId);
    updateLine(index, {
      itemId,
      unitPrice: Number(item?.standardSalesPrice ?? 0),
      taxPercent: Number(item?.taxRate?.rate ?? 18),
    });
  }

  function chooseSourceLine(index: number, sourceLineId: string) {
    const sourceLine = sourceLines.find((entry) => entry.id === sourceLineId);
    if (!sourceLine) {
      updateLine(index, { salesInvoiceLineId: sourceLineId });
      return;
    }
    updateLine(index, {
      salesInvoiceLineId: sourceLineId,
      itemId: sourceLine.itemId,
      unitPrice: Number(sourceLine.unitPrice ?? 0),
      taxPercent: Number(sourceLine.taxPercent ?? 0),
      description: sourceLine.item?.name ?? '',
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!form.customerId || !form.warehouseId) {
      setError('Zgjidh bleresin dhe magazinen.');
      return;
    }
    if (form.orderType === 'RETURN_ORDER' && !form.sourceSalesInvoiceId) {
      setError('Order kthimi duhet te lidhet me fature burim.');
      return;
    }
    const badLine = lines.findIndex(
      (line) => !line.itemId || Number(line.qty) <= 0,
    );
    if (badLine !== -1) {
      setError(`Rreshti ${badLine + 1}: zgjidh artikullin dhe sasine.`);
      return;
    }

    setBusy(true);
    const payload = {
      ...form,
      customerObjectId: form.customerObjectId || undefined,
      sourceSalesInvoiceId: form.sourceSalesInvoiceId || undefined,
      dueDate: form.dueDate || undefined,
      priority: Number(form.priority || 5),
      lines: lines.map((line) => ({
        ...line,
        salesInvoiceLineId: line.salesInvoiceLineId || undefined,
        qty: Number(line.qty),
        unitPrice: Number(line.unitPrice),
        discountPercent: Number(line.discountPercent ?? 0),
        taxPercent: Number(line.taxPercent),
        description: line.description || undefined,
        notes: line.notes || undefined,
      })),
    };

    try {
      if (data?.id) {
        await api.update('agent-orders', data.id, payload);
      } else {
        await api.create('agent-orders', payload);
      }
      router.push('/agjenti/orders');
      router.refresh();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Message error={error} />
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Detajet e order-it
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <select
            value={form.orderType}
            onChange={(event) =>
              setForm({ ...form, orderType: event.target.value })
            }
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {ORDER_TYPES.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
          <select
            value={form.customerId}
            onChange={(event) =>
              setForm({
                ...form,
                customerId: event.target.value,
                customerObjectId: '',
              })
            }
            required
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Bleresi</option>
            {customers.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {optionLabel(entry)}
              </option>
            ))}
          </select>
          <select
            value={form.customerObjectId}
            onChange={(event) =>
              setForm({ ...form, customerObjectId: event.target.value })
            }
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Objekti</option>
            {visibleObjects.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {optionLabel(entry)}
              </option>
            ))}
          </select>
          <select
            value={form.warehouseId}
            onChange={(event) =>
              setForm({ ...form, warehouseId: event.target.value })
            }
            required
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Magazina</option>
            {warehouses.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {optionLabel(entry)}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={form.docDate}
            onChange={(event) =>
              setForm({ ...form, docDate: event.target.value })
            }
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={form.dueDate}
            onChange={(event) =>
              setForm({ ...form, dueDate: event.target.value })
            }
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            min={1}
            max={10}
            value={form.priority}
            onChange={(event) =>
              setForm({ ...form, priority: Number(event.target.value) })
            }
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Prioriteti"
          />
          {isReturn ? (
            <select
              value={form.sourceSalesInvoiceId}
              onChange={(event) =>
                setForm({ ...form, sourceSalesInvoiceId: event.target.value })
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
            >
              <option value="">Fatura burim</option>
              {returnSources
                .filter(
                  (entry) =>
                    !form.customerId || entry.customerId === form.customerId,
                )
                .map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.docNo} - {entry.customer?.name ?? '-'}
                  </option>
                ))}
            </select>
          ) : null}
          <input
            value={form.notes}
            onChange={(event) =>
              setForm({ ...form, notes: event.target.value })
            }
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
            placeholder="Shenime"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Rreshtat
          </h2>
          <button
            type="button"
            onClick={() =>
              setLines([
                ...lines,
                {
                  itemId: '',
                  qty: 1,
                  unitPrice: 0,
                  discountPercent: 0,
                  taxPercent: 18,
                },
              ])
            }
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
          >
            Shto rresht
          </button>
        </div>
        <div className="space-y-3 p-4">
          {lines.map((line, index) => (
            <div
              key={index}
              className="grid grid-cols-1 gap-2 rounded-lg border border-slate-100 p-3 md:grid-cols-12"
            >
              {isReturn ? (
                <select
                  value={line.salesInvoiceLineId ?? ''}
                  onChange={(event) =>
                    chooseSourceLine(index, event.target.value)
                  }
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-3"
                >
                  <option value="">Rreshti burim</option>
                  {sourceLines.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.item?.code ?? ''}{' '}
                      {entry.item?.name ?? entry.itemId} / {Number(entry.qty)}
                    </option>
                  ))}
                </select>
              ) : null}
              <select
                value={line.itemId}
                onChange={(event) => chooseItem(index, event.target.value)}
                required
                disabled={isReturn && Boolean(line.salesInvoiceLineId)}
                className={`rounded-lg border border-slate-300 px-3 py-2 text-sm ${isReturn ? 'md:col-span-3' : 'md:col-span-4'}`}
              >
                <option value="">Artikulli</option>
                {items.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {optionLabel(entry)}
                  </option>
                ))}
              </select>
              <input
                value={line.description ?? ''}
                onChange={(event) =>
                  updateLine(index, { description: event.target.value })
                }
                placeholder="Pershkrimi"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
              />
              <input
                type="number"
                step="0.001"
                min="0.001"
                value={line.qty}
                onChange={(event) =>
                  updateLine(index, { qty: Number(event.target.value) })
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-1"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                value={line.unitPrice}
                onChange={(event) =>
                  updateLine(index, { unitPrice: Number(event.target.value) })
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-1"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={line.discountPercent}
                onChange={(event) =>
                  updateLine(index, {
                    discountPercent: Number(event.target.value),
                  })
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-1"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={line.taxPercent}
                onChange={(event) =>
                  updateLine(index, { taxPercent: Number(event.target.value) })
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-1"
              />
              <button
                type="button"
                onClick={() => setLines(lines.filter((_, i) => i !== index))}
                disabled={lines.length === 1}
                className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 disabled:opacity-40 md:col-span-1"
              >
                Hiq
              </button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-4 border-t border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <span>Net: {totals.net.toFixed(2)}</span>
          <span>TVSH: {totals.tax.toFixed(2)}</span>
          <span className="font-semibold text-slate-900">
            Total: {totals.total.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          disabled={busy}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy
            ? 'Duke ruajtur...'
            : data?.id
              ? 'Perditeso order-in'
              : 'Krijo order'}
        </button>
      </div>
    </form>
  );
}

export function AgentOrderActions({ order }: { order: any }) {
  const router = useRouter();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  async function run(action: string) {
    setBusy(action);
    setError('');
    try {
      await api.post(`agent-orders/${order.id}/${action}`, {});
      router.refresh();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy('');
    }
  }

  const actions = [
    { key: 'submit', label: 'Dorezo', show: order.status === 'DRAFT' },
    {
      key: 'approve',
      label: 'Aprovo',
      show: order.status === 'DRAFT' || order.status === 'SUBMITTED',
    },
    { key: 'start', label: 'Start WMS', show: order.status === 'WMS_ASSIGNED' },
    {
      key: 'complete-wms',
      label: 'Perfundo WMS',
      show: order.status === 'WMS_ASSIGNED' || order.status === 'PICKING',
    },
    {
      key: 'cancel',
      label: 'Anulo',
      show: !['DOCUMENT_CREATED', 'CANCELLED'].includes(order.status),
    },
  ];
  const canAssignOrder = ['SUBMITTED', 'APPROVED'].includes(order.status);

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        {actions
          .filter((entry) => entry.show)
          .map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => run(entry.key)}
              disabled={Boolean(busy)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
            >
              {busy === entry.key ? '...' : entry.label}
            </button>
          ))}
        {canAssignOrder ? (
          <a
            href={`/agjenti/orders/${order.id}/assign`}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white"
          >
            Cakto picker
          </a>
        ) : null}
      </div>
      <Message error={error} />
    </div>
  );
}

export function AgentOrderAssignForm({
  order,
  pickers,
}: {
  order: any;
  pickers: Option[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      await api.post(`agent-orders/${order.id}/assign`, {
        assignedPickerId: data.get('assignedPickerId'),
        notes: data.get('notes') || undefined,
      });
      router.push(`/agjenti/orders/${order.id}`);
      router.refresh();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-center gap-2 text-sm">
        <span className="font-semibold text-slate-900">{order.orderNo}</span>
        <StatusBadge value={order.status} />
      </div>
      <Message error={error} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <select
          name="assignedPickerId"
          defaultValue={order.assignedPickerId ?? ''}
          required
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Picker / receiver</option>
          {pickers.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {optionLabel(entry)}
            </option>
          ))}
        </select>
        <input
          name="notes"
          placeholder="Shenime per WMS"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
        />
      </div>
      <button
        disabled={busy}
        className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {busy ? 'Duke caktuar...' : 'Cakto WMS'}
      </button>
    </form>
  );
}

export function AgentOrderDocumentActions({
  order,
  invoiceSeries,
  returnSeries,
  paymentMethods,
}: {
  order: any;
  invoiceSeries: Option[];
  returnSeries: Option[];
  paymentMethods: Option[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const isReturn =
    order.orderType === 'RETURN_ORDER' ||
    order.orderType === 'OPEN_RETURN_ORDER';
  const series = isReturn ? returnSeries : invoiceSeries;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const data = new FormData(event.currentTarget);
    const endpoint = isReturn ? 'create-sales-return' : 'create-sales-invoice';
    try {
      const result: any = await api.post(
        `agent-orders/${order.id}/${endpoint}`,
        {
          seriesId: data.get('seriesId'),
          paymentMethodId: data.get('paymentMethodId') || undefined,
          postImmediately: !isReturn && data.get('postImmediately') === 'on',
          docDate: data.get('docDate') || undefined,
          dueDate: data.get('dueDate') || undefined,
          reason: data.get('reason') || undefined,
          notes: data.get('notes') || undefined,
        },
      );
      if (isReturn) {
        router.push(`/sales-returns/${result.salesReturn.id}`);
      } else {
        setMessage(
          result.posted
            ? 'Fatura u krijua, WMS u pergatit dhe fatura u postua.'
            : (result.postWarning ??
                (result.wms?.ready
                  ? 'Fatura u krijua dhe WMS u pergatit.'
                  : (result.wms?.warning ?? ''))),
        );
        router.push(`/sales-invoices/${result.salesInvoice.id}`);
      }
      router.refresh();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  if (order.status !== 'READY_FOR_DOCUMENT') return null;

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 className="text-sm font-semibold text-slate-900">
        {isReturn ? 'Krijo kthim shitje' : 'Krijo fature shitje'}
      </h2>
      <Message error={error} message={message} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <select
          name="seriesId"
          required
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Seria</option>
          {series.map((entry: any) => (
            <option key={entry.id} value={entry.id}>
              {entry.prefix ?? entry.code ?? entry.name}
            </option>
          ))}
        </select>
        {!isReturn ? (
          <select
            name="paymentMethodId"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Metoda pageses</option>
            {paymentMethods.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {optionLabel(entry)}
              </option>
            ))}
          </select>
        ) : (
          <input
            name="reason"
            placeholder="Arsyeja"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        )}
        <input
          name="docDate"
          type="date"
          defaultValue={today()}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        {!isReturn ? (
          <input
            name="dueDate"
            type="date"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        ) : null}
        {!isReturn ? (
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
            <input
              name="postImmediately"
              type="checkbox"
              defaultChecked
              className="h-4 w-4 rounded border-slate-300"
            />
            Posto menjehere
          </label>
        ) : null}
        <input
          name="notes"
          placeholder="Shenime"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-4"
        />
      </div>
      <button
        disabled={busy}
        className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {busy
          ? 'Duke krijuar...'
          : isReturn
            ? 'Krijo kthimin'
            : 'Krijo / posto faturen'}
      </button>
    </form>
  );
}

export function CustomerObjectForm({ customers }: { customers: Option[] }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const data = new FormData(event.currentTarget);
    try {
      await api.post('agent-orders/customer-objects', {
        customerId: data.get('customerId'),
        code: data.get('code'),
        name: data.get('name'),
        address: data.get('address') || undefined,
        city: data.get('city') || undefined,
        contactName: data.get('contactName') || undefined,
        phone: data.get('phone') || undefined,
        notes: data.get('notes') || undefined,
      });
      event.currentTarget.reset();
      setMessage('Objekti u krijua.');
      window.location.reload();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <Message error={error} message={message} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <select
          name="customerId"
          required
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Bleresi</option>
          {customers.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {optionLabel(entry)}
            </option>
          ))}
        </select>
        <input
          name="code"
          required
          placeholder="Kodi objektit"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          name="name"
          required
          placeholder="Emri objektit"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          name="address"
          placeholder="Adresa"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          name="city"
          placeholder="Qyteti"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          name="contactName"
          placeholder="Kontakt"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          name="phone"
          placeholder="Telefoni"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          name="notes"
          placeholder="Shenime"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
        />
      </div>
      <button
        disabled={busy}
        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {busy ? 'Duke ruajtur...' : 'Krijo objekt'}
      </button>
    </form>
  );
}
