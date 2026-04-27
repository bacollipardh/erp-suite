'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export function CreateApprovalRequestForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [entityType, setEntityType] = useState('supplier-payments');
  const [action, setAction] = useState('POST');
  const [title, setTitle] = useState('Supplier payment approval');
  const [entityNo, setEntityNo] = useState('PAG-APPROVAL-UI');
  const [amount, setAmount] = useState('750');
  const [description, setDescription] = useState('Approval request created from UI.');

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await api.post('approvals/requests', {
        entityType,
        action,
        title,
        entityNo: entityNo || undefined,
        amount: Number(amount || 0),
        description: description || undefined,
      });
      setOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(typeof err?.message === 'string' ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
        New Approval Request
      </button>
    );
  }

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">New Approval Request</h3>
          <p className="text-xs text-slate-500">Krijo manualisht request për testim të approval engine.</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50">Close</button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">Entity Type</span>
          <select value={entityType} onChange={(event) => setEntityType(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="supplier-payments">Supplier Payment</option>
            <option value="journal-entries">Manual Journal</option>
            <option value="sales-invoices">Sales Invoice</option>
            <option value="customers">Customer</option>
            <option value="sales-returns">Sales Return</option>
            <option value="finance-accounts">Finance Account</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">Action</span>
          <input value={action} onChange={(event) => setAction(event.target.value.toUpperCase())} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">Amount</span>
          <input value={amount} onChange={(event) => setAmount(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="font-medium text-slate-700">Title</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">Entity No</span>
          <input value={entityNo} onChange={(event) => setEntityNo(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="space-y-1 text-sm md:col-span-3">
          <span className="font-medium text-slate-700">Description</span>
          <textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
      </div>

      {error ? <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      <div className="mt-4 flex justify-end">
        <button type="button" disabled={busy} onClick={submit} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          {busy ? 'Creating...' : 'Create Request'}
        </button>
      </div>
    </div>
  );
}
