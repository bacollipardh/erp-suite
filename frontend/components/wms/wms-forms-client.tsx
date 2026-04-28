'use client';

import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';

type Option = { id: string; code?: string; name?: string };
type LocationOption = Option & {
  warehouseId: string;
  zone?: string;
  aisle?: string | null;
  rack?: string | null;
  shelf?: string | null;
  bin?: string | null;
};

function label(entry: Option) {
  return `${entry.code ? `${entry.code} - ` : ''}${entry.name ?? entry.id}`;
}

function locationLabel(entry: LocationOption) {
  return [entry.code, entry.zone, entry.aisle, entry.rack, entry.shelf, entry.bin]
    .filter(Boolean)
    .join(' / ');
}

function parseError(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Veprimi deshtoi.';
}

function Message({ message, error }: { message?: string | null; error?: string | null }) {
  if (error) {
    return <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>;
  }
  if (message) {
    return <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>;
  }
  return null;
}

export function WmsLocationForm({ warehouses }: { warehouses: Option[] }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const data = new FormData(event.currentTarget);
    const maxQty = data.get('maxQty');
    const maxWeight = data.get('maxWeight');
    const maxVolume = data.get('maxVolume');
    try {
      await api.post('wms/locations', {
        warehouseId: data.get('warehouseId'),
        code: data.get('code'),
        barcode: data.get('barcode') || undefined,
        zone: data.get('zone'),
        aisle: data.get('aisle') || undefined,
        rack: data.get('rack') || undefined,
        shelf: data.get('shelf') || undefined,
        bin: data.get('bin') || undefined,
        locationType: data.get('locationType') || undefined,
        status: data.get('status') || undefined,
        maxQty: maxQty ? Number(maxQty) : undefined,
        maxWeight: maxWeight ? Number(maxWeight) : undefined,
        maxVolume: maxVolume ? Number(maxVolume) : undefined,
        notes: data.get('notes') || undefined,
      });
      event.currentTarget.reset();
      setMessage('Lokacioni WMS u krijua.');
      window.location.reload();
    } catch (err) {
      setError(parseError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Lokacion i ri</h2>
        <p className="mt-1 text-sm text-slate-500">Zone / Aisle / Rack / Shelf / Bin me barcode opsional.</p>
      </div>
      <Message message={message} error={error} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <select name="warehouseId" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">Magazina</option>
          {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{label(warehouse)}</option>)}
        </select>
        <input name="code" required placeholder="Kodi lokacionit" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="barcode" placeholder="Barcode" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="zone" required placeholder="Zone" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="aisle" placeholder="Aisle" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="rack" placeholder="Rack" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="shelf" placeholder="Shelf" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="bin" placeholder="Bin" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <select name="locationType" defaultValue="STORAGE" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          {['RECEIVING', 'STORAGE', 'PICKING', 'PACKING', 'SHIPPING', 'QUARANTINE', 'RETURNS', 'DAMAGED'].map((entry) => <option key={entry}>{entry}</option>)}
        </select>
        <select name="status" defaultValue="ACTIVE" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          {['ACTIVE', 'BLOCKED', 'QUARANTINE', 'FULL', 'DAMAGED', 'INACTIVE'].map((entry) => <option key={entry}>{entry}</option>)}
        </select>
        <input name="maxQty" type="number" step="0.001" placeholder="Max qty" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="notes" placeholder="Shenime" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <button disabled={busy} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {busy ? 'Duke ruajtur...' : 'Krijo lokacion'}
      </button>
    </form>
  );
}

export function WmsReceiveForm({ locations, items }: { locations: LocationOption[]; items: Option[] }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const data = new FormData(event.currentTarget);
    const serialNumbers = String(data.get('serialNumbers') ?? '')
      .split(/\r?\n|,/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    try {
      const result: any = await api.post('wms/receive', {
        locationId: data.get('locationId'),
        itemId: data.get('itemId'),
        qty: Number(data.get('qty') || serialNumbers.length || 0),
        lotCode: data.get('lotCode') || undefined,
        expiryDate: data.get('expiryDate') || undefined,
        manufacturingDate: data.get('manufacturingDate') || undefined,
        serialNumbers,
        referenceNo: data.get('referenceNo') || undefined,
        inventoryStatus: data.get('inventoryStatus') || undefined,
        notes: data.get('notes') || undefined,
      });
      event.currentTarget.reset();
      setMessage(`Pranimi u ruajt: ${result.referenceNo}`);
    } catch (err) {
      setError(parseError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <Message message={message} error={error} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <select name="locationId" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">Lokacioni pranimit</option>
          {locations.map((location) => <option key={location.id} value={location.id}>{locationLabel(location)}</option>)}
        </select>
        <select name="itemId" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">Artikulli</option>
          {items.map((item) => <option key={item.id} value={item.id}>{label(item)}</option>)}
        </select>
        <input name="qty" type="number" step="0.001" placeholder="Sasia" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="lotCode" placeholder="Lot kodi" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="expiryDate" type="date" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="manufacturingDate" type="date" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="referenceNo" placeholder="Reference" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <select name="inventoryStatus" defaultValue="AVAILABLE" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          {['AVAILABLE', 'QUARANTINE', 'DAMAGED'].map((entry) => <option key={entry}>{entry}</option>)}
        </select>
        <input name="notes" placeholder="Shenime" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <textarea name="serialNumbers" placeholder="Serial numbers, nje per rresht" className="min-h-28 rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-3" />
      </div>
      <button disabled={busy} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {busy ? 'Duke pranuar...' : 'Ruaj pranimin'}
      </button>
    </form>
  );
}

export function WmsMoveForm({ locations, items }: { locations: LocationOption[]; items: Option[] }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const data = new FormData(event.currentTarget);
    try {
      const result: any = await api.post('wms/move', {
        fromLocationId: data.get('fromLocationId'),
        toLocationId: data.get('toLocationId'),
        itemId: data.get('itemId'),
        qty: Number(data.get('qty') || 0),
        lotCode: data.get('lotCode') || undefined,
        serialNo: data.get('serialNo') || undefined,
        expiryDate: data.get('expiryDate') || undefined,
        referenceNo: data.get('referenceNo') || undefined,
        notes: data.get('notes') || undefined,
      });
      event.currentTarget.reset();
      setMessage(`Levizja u ruajt: ${result.referenceNo}`);
    } catch (err) {
      setError(parseError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <Message message={message} error={error} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <select name="fromLocationId" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">Nga lokacioni</option>
          {locations.map((location) => <option key={location.id} value={location.id}>{locationLabel(location)}</option>)}
        </select>
        <select name="toLocationId" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">Ne lokacion</option>
          {locations.map((location) => <option key={location.id} value={location.id}>{locationLabel(location)}</option>)}
        </select>
        <select name="itemId" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">Artikulli</option>
          {items.map((item) => <option key={item.id} value={item.id}>{label(item)}</option>)}
        </select>
        <input name="qty" type="number" step="0.001" placeholder="Sasia" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="lotCode" placeholder="Lot kodi" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="serialNo" placeholder="Serial number" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="expiryDate" type="date" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="referenceNo" placeholder="Reference" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="notes" placeholder="Shenime" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <button disabled={busy} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {busy ? 'Duke levizur...' : 'Ruaj levizjen'}
      </button>
    </form>
  );
}

export function WmsCountForm({ locations, items }: { locations: LocationOption[]; items: Option[] }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const data = new FormData(event.currentTarget);
    try {
      const result: any = await api.post('wms/count', {
        locationId: data.get('locationId'),
        itemId: data.get('itemId'),
        countedQty: Number(data.get('countedQty') || 0),
        lotCode: data.get('lotCode') || undefined,
        serialNo: data.get('serialNo') || undefined,
        expiryDate: data.get('expiryDate') || undefined,
        referenceNo: data.get('referenceNo') || undefined,
        notes: data.get('notes') || undefined,
      });
      setMessage(`Count u ruajt: ${result.referenceNo}. Diferenca: ${result.difference}`);
    } catch (err) {
      setError(parseError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <Message message={message} error={error} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <select name="locationId" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">Lokacioni</option>
          {locations.map((location) => <option key={location.id} value={location.id}>{locationLabel(location)}</option>)}
        </select>
        <select name="itemId" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">Artikulli</option>
          {items.map((item) => <option key={item.id} value={item.id}>{label(item)}</option>)}
        </select>
        <input name="countedQty" required type="number" step="0.001" placeholder="Sasia e numeruar" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="lotCode" placeholder="Lot kodi" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="serialNo" placeholder="Serial number" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="expiryDate" type="date" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="referenceNo" placeholder="Reference" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="notes" placeholder="Shenime" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <button disabled={busy} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {busy ? 'Duke ruajtur...' : 'Ruaj count'}
      </button>
    </form>
  );
}

export function WmsStatusForm({ locations, items }: { locations: LocationOption[]; items: Option[] }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const data = new FormData(event.currentTarget);
    try {
      await api.post('wms/status', {
        locationId: data.get('locationId'),
        itemId: data.get('itemId'),
        inventoryStatus: data.get('inventoryStatus'),
        lotCode: data.get('lotCode') || undefined,
        serialNo: data.get('serialNo') || undefined,
        expiryDate: data.get('expiryDate') || undefined,
        notes: data.get('notes') || undefined,
      });
      setMessage('Statusi i stokut u perditesua.');
    } catch (err) {
      setError(parseError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <Message message={message} error={error} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <select name="locationId" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">Lokacioni</option>
          {locations.map((location) => <option key={location.id} value={location.id}>{locationLabel(location)}</option>)}
        </select>
        <select name="itemId" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">Artikulli</option>
          {items.map((item) => <option key={item.id} value={item.id}>{label(item)}</option>)}
        </select>
        <select name="inventoryStatus" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          {['AVAILABLE', 'QUARANTINE', 'DAMAGED', 'EXPIRED'].map((entry) => <option key={entry}>{entry}</option>)}
        </select>
        <input name="lotCode" placeholder="Lot kodi" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="serialNo" placeholder="Serial number" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="expiryDate" type="date" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="notes" placeholder="Shenime QC" className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-3" />
      </div>
      <button disabled={busy} className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {busy ? 'Duke perditesuar...' : 'Ndrysho statusin'}
      </button>
    </form>
  );
}

export function WmsPickingClient({ invoices }: { invoices: Array<{ id: string; docNo: string; customer?: { name: string } | null }> }) {
  const [invoiceId, setInvoiceId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  async function action(kind: 'plan' | 'confirm' | 'release') {
    if (!invoiceId) {
      setError('Zgjidh faturën e shitjes.');
      return;
    }
    setBusy(kind);
    setError('');
    setMessage('');
    try {
      await api.post(`wms/picking/sales-invoices/${invoiceId}/${kind}`, {});
      setMessage(kind === 'plan' ? 'Pick plan u krijua.' : kind === 'confirm' ? 'Picking u konfirmua.' : 'Rezervimet u liruan.');
    } catch (err) {
      setError(parseError(err));
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <Message message={message} error={error} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto_auto]">
        <select value={invoiceId} onChange={(event) => setInvoiceId(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">Zgjidh sales invoice draft</option>
          {invoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.docNo} - {invoice.customer?.name ?? '-'}</option>)}
        </select>
        <button type="button" onClick={() => action('plan')} disabled={Boolean(busy)} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {busy === 'plan' ? 'Duke planifikuar...' : 'Plan pick'}
        </button>
        <button type="button" onClick={() => action('confirm')} disabled={Boolean(busy)} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {busy === 'confirm' ? 'Duke konfirmuar...' : 'Confirm pick'}
        </button>
        <button type="button" onClick={() => action('release')} disabled={Boolean(busy)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50">
          Release
        </button>
      </div>
    </div>
  );
}

export function WmsScannerClient() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(await api.query('wms/scan', { code }));
    } catch (err) {
      setError(parseError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <input value={code} onChange={(event) => setCode(event.target.value)} autoFocus placeholder="Scan barcode, item code, location, lot ose serial" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <button disabled={busy} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {busy ? 'Duke kerkuar...' : 'Scan'}
        </button>
      </form>
      <Message error={error} />
      {result ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {(['items', 'locations', 'stocks'] as const).map((key) => (
            <div key={key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold capitalize text-slate-900">{key}</h2>
              <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
                {JSON.stringify(result[key] ?? [], null, 2)}
              </pre>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function WmsWorkflowMoveForm({
  endpoint,
  locations,
  items,
  fromLabel,
  toLabel,
  buttonLabel,
  buttonClassName,
}: {
  endpoint: string;
  locations: LocationOption[];
  items: Option[];
  fromLabel: string;
  toLabel: string;
  buttonLabel: string;
  buttonClassName: string;
}) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const data = new FormData(event.currentTarget);
    try {
      const result: any = await api.post(endpoint, {
        fromLocationId: data.get('fromLocationId'),
        toLocationId: data.get('toLocationId'),
        itemId: data.get('itemId'),
        qty: Number(data.get('qty') || 0),
        lotCode: data.get('lotCode') || undefined,
        serialNo: data.get('serialNo') || undefined,
        expiryDate: data.get('expiryDate') || undefined,
        referenceNo: data.get('referenceNo') || undefined,
        notes: data.get('notes') || undefined,
      });
      event.currentTarget.reset();
      setMessage(`Workflow u ruajt: ${result.referenceNo}`);
    } catch (err) {
      setError(parseError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <Message message={message} error={error} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <select name="fromLocationId" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">{fromLabel}</option>
          {locations.map((location) => <option key={location.id} value={location.id}>{locationLabel(location)}</option>)}
        </select>
        <select name="toLocationId" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">{toLabel}</option>
          {locations.map((location) => <option key={location.id} value={location.id}>{locationLabel(location)}</option>)}
        </select>
        <select name="itemId" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">Artikulli</option>
          {items.map((item) => <option key={item.id} value={item.id}>{label(item)}</option>)}
        </select>
        <input name="qty" type="number" step="0.001" placeholder="Sasia" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="lotCode" placeholder="Lot kodi" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="serialNo" placeholder="Serial number" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="expiryDate" type="date" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="referenceNo" placeholder="Reference" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="notes" placeholder="Shenime" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <button disabled={busy} className={`${buttonClassName} rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-50`}>
        {busy ? 'Duke ruajtur...' : buttonLabel}
      </button>
    </form>
  );
}

export function WmsPutawayForm({ locations, items }: { locations: LocationOption[]; items: Option[] }) {
  return (
    <WmsWorkflowMoveForm
      endpoint="wms/putaway"
      locations={locations}
      items={items}
      fromLabel="Nga receiving / returns"
      toLabel="Ne storage / picking"
      buttonLabel="Ruaj putaway"
      buttonClassName="bg-blue-600"
    />
  );
}

export function WmsReplenishmentForm({ locations, items }: { locations: LocationOption[]; items: Option[] }) {
  return (
    <WmsWorkflowMoveForm
      endpoint="wms/replenish"
      locations={locations}
      items={items}
      fromLabel="Nga storage"
      toLabel="Ne picking"
      buttonLabel="Ruaj replenishment"
      buttonClassName="bg-cyan-600"
    />
  );
}

export function WmsCycleCountPlanForm({
  warehouses,
  locations,
  items,
}: {
  warehouses: Option[];
  locations: LocationOption[];
  items: Option[];
}) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const data = new FormData(event.currentTarget);
    try {
      const result: any = await api.post('wms/cycle-counts/plan', {
        warehouseId: data.get('warehouseId'),
        locationId: data.get('locationId') || undefined,
        itemId: data.get('itemId') || undefined,
        referenceNo: data.get('referenceNo') || undefined,
        notes: data.get('notes') || undefined,
      });
      event.currentTarget.reset();
      setMessage(`Plani u krijua: ${result.referenceNo}. Detyra: ${result.tasks}`);
    } catch (err) {
      setError(parseError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <Message message={message} error={error} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <select name="warehouseId" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">Magazina</option>
          {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{label(warehouse)}</option>)}
        </select>
        <select name="locationId" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">Te gjitha lokacionet</option>
          {locations.map((location) => <option key={location.id} value={location.id}>{locationLabel(location)}</option>)}
        </select>
        <select name="itemId" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">Te gjithe artikujt</option>
          {items.map((item) => <option key={item.id} value={item.id}>{label(item)}</option>)}
        </select>
        <input name="referenceNo" placeholder="Reference" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="notes" placeholder="Shenime" className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
      </div>
      <button disabled={busy} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {busy ? 'Duke krijuar...' : 'Krijo plan count'}
      </button>
    </form>
  );
}

export function WmsExpiryActions() {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function markExpired() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result: any = await api.post('wms/expiry/mark-expired', {});
      setMessage(`U bllokuan ${result.rows} rreshta te skaduar. Sasia: ${result.qtyOnHand}`);
      window.location.reload();
    } catch (err) {
      setError(parseError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <Message message={message} error={error} />
      <button type="button" onClick={markExpired} disabled={busy} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {busy ? 'Duke bllokuar...' : 'Blloko stokun e skaduar'}
      </button>
    </div>
  );
}

export function WmsPackingClient({ invoices }: { invoices: Array<{ id: string; docNo: string; customer?: { name: string } | null }> }) {
  const [invoiceId, setInvoiceId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function pack() {
    if (!invoiceId) {
      setError('Zgjidh faturën e shitjes.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api.post(`wms/packing/sales-invoices/${invoiceId}/pack`, {});
      setMessage('Packing u konfirmua. Fatura tani mund te postohet/shipped.');
    } catch (err) {
      setError(parseError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <Message message={message} error={error} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
        <select value={invoiceId} onChange={(event) => setInvoiceId(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">Zgjidh sales invoice draft</option>
          {invoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.docNo} - {invoice.customer?.name ?? '-'}</option>)}
        </select>
        <button type="button" onClick={pack} disabled={busy} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {busy ? 'Duke paketuar...' : 'Konfirmo packing'}
        </button>
      </div>
    </div>
  );
}

export function WmsTaskActionsClient({ taskId, status }: { taskId: string; status?: string | null }) {
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const closed = status === 'DONE' || status === 'CANCELLED' || status === 'SHORT';

  async function action(kind: 'start' | 'complete' | 'cancel' | 'short') {
    setBusy(kind);
    setMessage('');
    setError('');
    try {
      await api.post(`wms/tasks/${taskId}/${kind}`, {});
      setMessage('OK');
      window.location.reload();
    } catch (err) {
      setError(parseError(err));
    } finally {
      setBusy('');
    }
  }

  if (closed) return <span className="text-xs text-slate-400">Mbyllur</span>;

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => action('start')} disabled={Boolean(busy)} className="rounded-lg border border-blue-200 px-2 py-1 text-xs font-medium text-blue-700 disabled:opacity-50">
        {busy === 'start' ? '...' : 'Start'}
      </button>
      <button type="button" onClick={() => action('complete')} disabled={Boolean(busy)} className="rounded-lg border border-emerald-200 px-2 py-1 text-xs font-medium text-emerald-700 disabled:opacity-50">
        {busy === 'complete' ? '...' : 'Done'}
      </button>
      <button type="button" onClick={() => action('short')} disabled={Boolean(busy)} className="rounded-lg border border-amber-200 px-2 py-1 text-xs font-medium text-amber-700 disabled:opacity-50">
        Short
      </button>
      <button type="button" onClick={() => action('cancel')} disabled={Boolean(busy)} className="rounded-lg border border-rose-200 px-2 py-1 text-xs font-medium text-rose-700 disabled:opacity-50">
        Cancel
      </button>
      {message || error ? <span className={`text-xs ${error ? 'text-rose-600' : 'text-emerald-600'}`}>{error || message}</span> : null}
    </div>
  );
}
