'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

type Policy = {
  id: string;
  code: string;
  name: string;
  entityType: string;
  action: string;
  minAmount: number | null;
  maxAmount: number | null;
  requiredSteps: number;
  isActive: boolean;
};

type FormState = {
  code: string;
  name: string;
  entityType: string;
  action: string;
  minAmount: string;
  maxAmount: string;
  requiredSteps: string;
  isActive: boolean;
};

const inputClass = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200';

const defaults: FormState = {
  code: 'NEW_POLICY',
  name: 'New approval policy',
  entityType: 'supplier-payments',
  action: 'POST',
  minAmount: '0',
  maxAmount: '',
  requiredSteps: '1',
  isActive: true,
};

function toBody(form: FormState) {
  return {
    code: form.code,
    name: form.name,
    entityType: form.entityType,
    action: form.action,
    minAmount: form.minAmount === '' ? null : Number(form.minAmount),
    maxAmount: form.maxAmount === '' ? null : Number(form.maxAmount),
    requiredSteps: Number(form.requiredSteps || 1),
    isActive: form.isActive,
  };
}

function fromPolicy(policy: Policy): FormState {
  return {
    code: policy.code,
    name: policy.name,
    entityType: policy.entityType,
    action: policy.action,
    minAmount: policy.minAmount === null ? '' : String(policy.minAmount),
    maxAmount: policy.maxAmount === null ? '' : String(policy.maxAmount),
    requiredSteps: String(policy.requiredSteps),
    isActive: policy.isActive,
  };
}

export function PolicyAdminPanel({ policies }: { policies: Policy[] }) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<FormState>(defaults);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(defaults);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function updateCreate(key: keyof FormState, value: string | boolean) {
    setCreateForm((current) => ({ ...current, [key]: value }));
  }

  function updateEdit(key: keyof FormState, value: string | boolean) {
    setEditForm((current) => ({ ...current, [key]: value }));
  }

  async function createPolicy() {
    setBusy(true);
    setError('');
    try {
      await api.post('approvals/policies', toBody(createForm));
      setCreateOpen(false);
      setCreateForm(defaults);
      router.refresh();
    } catch (err: any) {
      setError(typeof err?.message === 'string' ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  async function savePolicy() {
    if (!editId) return;
    setBusy(true);
    setError('');
    try {
      await api.update('approvals/policies', editId, toBody(editForm));
      setEditId(null);
      router.refresh();
    } catch (err: any) {
      setError(typeof err?.message === 'string' ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  function startEdit(policy: Policy) {
    setEditId(policy.id);
    setEditForm(fromPolicy(policy));
    setError('');
  }

  function fields(form: FormState, update: (key: keyof FormState, value: string | boolean) => void) {
    return (
      <div className="grid gap-3 md:grid-cols-4">
        <label className="space-y-1 text-sm"><span className="font-medium text-slate-700">Code</span><input className={inputClass} value={form.code} onChange={(e) => update('code', e.target.value.toUpperCase())} /></label>
        <label className="space-y-1 text-sm"><span className="font-medium text-slate-700">Name</span><input className={inputClass} value={form.name} onChange={(e) => update('name', e.target.value)} /></label>
        <label className="space-y-1 text-sm"><span className="font-medium text-slate-700">Entity Type</span><select className={inputClass} value={form.entityType} onChange={(e) => update('entityType', e.target.value)}><option value="supplier-payments">supplier-payments</option><option value="journal-entries">journal-entries</option><option value="sales-returns">sales-returns</option><option value="customers">customers</option><option value="sales-invoices">sales-invoices</option><option value="finance-accounts">finance-accounts</option></select></label>
        <label className="space-y-1 text-sm"><span className="font-medium text-slate-700">Action</span><input className={inputClass} value={form.action} onChange={(e) => update('action', e.target.value.toUpperCase())} /></label>
        <label className="space-y-1 text-sm"><span className="font-medium text-slate-700">Min Amount</span><input className={inputClass} value={form.minAmount} onChange={(e) => update('minAmount', e.target.value)} /></label>
        <label className="space-y-1 text-sm"><span className="font-medium text-slate-700">Max Amount</span><input className={inputClass} value={form.maxAmount} onChange={(e) => update('maxAmount', e.target.value)} placeholder="No limit" /></label>
        <label className="space-y-1 text-sm"><span className="font-medium text-slate-700">Steps</span><select className={inputClass} value={form.requiredSteps} onChange={(e) => update('requiredSteps', e.target.value)}><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option></select></label>
        <label className="flex items-center gap-2 pt-7 text-sm"><input type="checkbox" checked={form.isActive} onChange={(e) => update('isActive', e.target.checked)} /><span className="font-medium text-slate-700">Active</span></label>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" onClick={() => setCreateOpen((value) => !value)} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">New Policy</button>
      </div>

      {createOpen ? (
        <section className="rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Create Approval Policy</h2>
          <div className="mt-4">{fields(createForm, updateCreate)}</div>
          <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setCreateOpen(false)} className="rounded-lg border px-3 py-2 text-sm">Cancel</button><button type="button" disabled={busy} onClick={createPolicy} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Create</button></div>
        </section>
      ) : null}

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">Approval Policies</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-white"><tr>{['Status', 'Code / Name', 'Entity', 'Action', 'Range', 'Steps', 'Actions'].map((title) => <th key={title} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {policies.map((policy) => (
                <tr key={policy.id} className="align-top hover:bg-slate-50/70">
                  <td className="px-3 py-3"><span className={`rounded-full border px-2 py-1 text-xs font-semibold ${policy.isActive ? 'border-emerald-200 bg-emerald-100 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>{policy.isActive ? 'ACTIVE' : 'INACTIVE'}</span></td>
                  <td className="px-3 py-3 min-w-72"><div className="font-semibold text-slate-900">{policy.code}</div><div className="text-xs text-slate-500">{policy.name}</div></td>
                  <td className="px-3 py-3 whitespace-nowrap">{policy.entityType}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{policy.action}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{policy.minAmount ?? '0'} - {policy.maxAmount ?? '∞'} EUR</td>
                  <td className="px-3 py-3 whitespace-nowrap">{policy.requiredSteps}</td>
                  <td className="px-3 py-3 whitespace-nowrap"><button type="button" onClick={() => startEdit(policy)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-slate-50">Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editId ? (
        <section className="rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Edit Approval Policy</h2>
          <div className="mt-4">{fields(editForm, updateEdit)}</div>
          <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setEditId(null)} className="rounded-lg border px-3 py-2 text-sm">Cancel</button><button type="button" disabled={busy} onClick={savePolicy} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Save</button></div>
        </section>
      ) : null}
    </div>
  );
}
