'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

type Policy = { id: string; code: string; name: string; entityType: string; action: string; minAmount: number | null; maxAmount: number | null; requiredSteps: number; isActive: boolean; slaHours?: number; autoApprove?: boolean };
type PolicyStep = { id: string; stepNo: number; approverRoleCode: string | null; approverUserId: string | null; approverUserName?: string | null; label: string | null; isRequired: boolean };
type FormState = { code: string; name: string; entityType: string; action: string; minAmount: string; maxAmount: string; requiredSteps: string; isActive: boolean; slaHours: string; autoApprove: boolean };
type StepForm = { stepNo: number; label: string; approverRoleCode: string; approverUserId: string; isRequired: boolean };

const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200';
const modalButton = 'rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50';
const primaryButton = 'rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50';
const defaults: FormState = { code: 'NEW_POLICY', name: 'New approval policy', entityType: 'supplier-payments', action: 'POST', minAmount: '0', maxAmount: '', requiredSteps: '1', isActive: true, slaHours: '24', autoApprove: false };

function toBody(form: FormState) {
  return { code: form.code, name: form.name, entityType: form.entityType, action: form.action, minAmount: form.minAmount === '' ? null : Number(form.minAmount), maxAmount: form.maxAmount === '' ? null : Number(form.maxAmount), requiredSteps: Number(form.requiredSteps || 1), isActive: form.isActive, slaHours: Number(form.slaHours || 24), autoApprove: form.autoApprove };
}

function fromPolicy(policy: Policy): FormState {
  return { code: policy.code, name: policy.name, entityType: policy.entityType, action: policy.action, minAmount: policy.minAmount === null ? '' : String(policy.minAmount), maxAmount: policy.maxAmount === null ? '' : String(policy.maxAmount), requiredSteps: String(policy.requiredSteps), isActive: policy.isActive, slaHours: String(policy.slaHours ?? 24), autoApprove: Boolean(policy.autoApprove) };
}

function normalizeSteps(policy: Policy, rows: PolicyStep[]): StepForm[] {
  return Array.from({ length: policy.requiredSteps }, (_, index) => {
    const stepNo = index + 1;
    const row = rows.find((item) => item.stepNo === stepNo);
    return { stepNo, label: row?.label ?? `Step ${stepNo}`, approverRoleCode: row?.approverRoleCode ?? '', approverUserId: row?.approverUserId ?? '', isRequired: row?.isRequired ?? true };
  });
}

function Modal({ title, description, children, onClose }: { title: string; description?: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/40 px-4 py-10 backdrop-blur-sm">
      <div className="max-h-[calc(100vh-5rem)] w-full max-w-5xl overflow-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-white px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-950">{title}</h2>
            {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border px-3 py-1.5 text-xs font-semibold hover:bg-slate-50">Close</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function PolicyAdminPanel({ policies }: { policies: Policy[] }) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<FormState>(defaults);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(defaults);
  const [stepPolicy, setStepPolicy] = useState<Policy | null>(null);
  const [stepForms, setStepForms] = useState<StepForm[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const updateCreate = (key: keyof FormState, value: string | boolean) => setCreateForm((current) => ({ ...current, [key]: value }));
  const updateEdit = (key: keyof FormState, value: string | boolean) => setEditForm((current) => ({ ...current, [key]: value }));

  async function createPolicy() {
    setBusy(true); setError('');
    try { await api.post('approvals/policies', toBody(createForm)); setCreateOpen(false); setCreateForm(defaults); router.refresh(); }
    catch (err: any) { setError(typeof err?.message === 'string' ? err.message : 'Create failed'); }
    finally { setBusy(false); }
  }

  async function savePolicy() {
    if (!editId) return;
    setBusy(true); setError('');
    try { await api.update('approvals/policies', editId, toBody(editForm)); setEditId(null); router.refresh(); }
    catch (err: any) { setError(typeof err?.message === 'string' ? err.message : 'Update failed'); }
    finally { setBusy(false); }
  }

  function startEdit(policy: Policy) { setEditId(policy.id); setEditForm(fromPolicy(policy)); setError(''); }

  async function openSteps(policy: Policy) {
    setBusy(true); setError('');
    try {
      const data = await api.query<{ items: PolicyStep[] }>(`approvals/policies/${policy.id}/steps`);
      setStepPolicy(policy);
      setStepForms(normalizeSteps(policy, data.items));
    } catch (err: any) { setError(typeof err?.message === 'string' ? err.message : 'Load steps failed'); }
    finally { setBusy(false); }
  }

  function updateStep(index: number, key: keyof StepForm, value: string | boolean) {
    setStepForms((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  }

  async function saveSteps() {
    if (!stepPolicy) return;
    setBusy(true); setError('');
    try {
      await api.update(`approvals/policies/${stepPolicy.id}`, 'steps', {
        steps: stepForms.map((step) => ({ stepNo: step.stepNo, label: step.label, approverRoleCode: step.approverRoleCode || null, approverUserId: step.approverUserId || null, isRequired: step.isRequired })),
      });
      setStepPolicy(null);
      router.refresh();
    } catch (err: any) { setError(typeof err?.message === 'string' ? err.message : 'Save steps failed'); }
    finally { setBusy(false); }
  }

  function fields(form: FormState, update: (key: keyof FormState, value: string | boolean) => void) {
    return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <label className="space-y-1 text-sm"><span className="font-medium text-slate-700">Code</span><input className={inputClass} value={form.code} onChange={(e) => update('code', e.target.value.toUpperCase())} /></label>
      <label className="space-y-1 text-sm md:col-span-2 xl:col-span-1"><span className="font-medium text-slate-700">Name</span><input className={inputClass} value={form.name} onChange={(e) => update('name', e.target.value)} /></label>
      <label className="space-y-1 text-sm"><span className="font-medium text-slate-700">Entity Type</span><select className={inputClass} value={form.entityType} onChange={(e) => update('entityType', e.target.value)}><option value="supplier-payments">supplier-payments</option><option value="journal-entries">journal-entries</option><option value="sales-returns">sales-returns</option><option value="customers">customers</option><option value="sales-invoices">sales-invoices</option><option value="finance-accounts">finance-accounts</option></select></label>
      <label className="space-y-1 text-sm"><span className="font-medium text-slate-700">Action</span><input className={inputClass} value={form.action} onChange={(e) => update('action', e.target.value.toUpperCase())} /></label>
      <label className="space-y-1 text-sm"><span className="font-medium text-slate-700">Min Amount</span><input className={inputClass} value={form.minAmount} onChange={(e) => update('minAmount', e.target.value)} /></label>
      <label className="space-y-1 text-sm"><span className="font-medium text-slate-700">Max Amount</span><input className={inputClass} value={form.maxAmount} onChange={(e) => update('maxAmount', e.target.value)} placeholder="No limit" /></label>
      <label className="space-y-1 text-sm"><span className="font-medium text-slate-700">Steps</span><select className={inputClass} value={form.requiredSteps} onChange={(e) => update('requiredSteps', e.target.value)}><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option></select></label>
      <label className="space-y-1 text-sm"><span className="font-medium text-slate-700">SLA (orë)</span><input type="number" min="1" className={inputClass} value={form.slaHours} onChange={(e) => update('slaHours', e.target.value)} placeholder="24" /></label>
      <div className="flex items-center gap-4 rounded-xl border bg-slate-50 px-3 py-2 xl:col-span-2">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(e) => update('isActive', e.target.checked)} /><span className="font-medium text-slate-700">Active</span></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.autoApprove} onChange={(e) => update('autoApprove', e.target.checked)} /><span className="font-medium text-slate-700">Auto-Approve</span></label>
      </div>
    </div>;
  }

  return <div className="space-y-4">
    <div className="flex justify-end"><button type="button" onClick={() => setCreateOpen(true)} className={primaryButton}>New Policy</button></div>
    {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="border-b bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">Approval Policies</div><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="border-b bg-white"><tr>{['Status', 'Code / Name', 'Entity', 'Action', 'Range', 'Steps', 'SLA', 'Auto', 'Actions'].map((title) => <th key={title} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{policies.map((policy) => <tr key={policy.id} className="align-top hover:bg-slate-50/70"><td className="px-3 py-3"><span className={`rounded-full border px-2 py-1 text-xs font-semibold ${policy.isActive ? 'border-emerald-200 bg-emerald-100 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>{policy.isActive ? 'ACTIVE' : 'INACTIVE'}</span></td><td className="px-3 py-3 min-w-72"><div className="font-semibold text-slate-900">{policy.code}</div><div className="text-xs text-slate-500">{policy.name}</div></td><td className="px-3 py-3 whitespace-nowrap">{policy.entityType}</td><td className="px-3 py-3 whitespace-nowrap">{policy.action}</td><td className="px-3 py-3 whitespace-nowrap">{policy.minAmount ?? '0'} - {policy.maxAmount ?? '∞'} EUR</td><td className="px-3 py-3 whitespace-nowrap">{policy.requiredSteps}</td><td className="px-3 py-3 whitespace-nowrap text-xs text-slate-600">{policy.slaHours ?? 24}h</td><td className="px-3 py-3 whitespace-nowrap">{policy.autoApprove ? <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">AUTO</span> : <span className="text-xs text-slate-400">—</span>}</td><td className="px-3 py-3 whitespace-nowrap"><div className="flex gap-2"><button type="button" onClick={() => startEdit(policy)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-slate-50">Edit</button><button type="button" onClick={() => openSteps(policy)} className="rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50">Steps</button></div></td></tr>)}</tbody></table></div></section>
    {createOpen ? <Modal title="Create Approval Policy" description="Krijo rregull të ri aprovimi pa e shtyrë tabelën poshtë." onClose={() => setCreateOpen(false)}><div>{fields(createForm, updateCreate)}</div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setCreateOpen(false)} className={modalButton}>Cancel</button><button type="button" disabled={busy} onClick={createPolicy} className={primaryButton}>Create</button></div></Modal> : null}
    {editId ? <Modal title="Edit Approval Policy" description="Ndrysho limitet, statusin dhe numrin e hapave." onClose={() => setEditId(null)}><div>{fields(editForm, updateEdit)}</div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setEditId(null)} className={modalButton}>Cancel</button><button type="button" disabled={busy} onClick={savePolicy} className={primaryButton}>Save</button></div></Modal> : null}
    {stepPolicy ? <Modal title={`Approver Steps — ${stepPolicy.code}`} description="Vendos role/user approver për çdo hap. Role code shembull: ADMIN, FINANCE_MANAGER." onClose={() => setStepPolicy(null)}><div className="space-y-3">{stepForms.map((step, index) => <div key={step.stepNo} className="grid gap-3 rounded-xl border bg-slate-50 p-3 md:grid-cols-[90px_1fr_1fr_1fr_120px]"><div className="pt-2 text-sm font-semibold text-slate-900">Step {step.stepNo}</div><input className={inputClass} value={step.label} onChange={(e) => updateStep(index, 'label', e.target.value)} placeholder="Label" /><input className={inputClass} value={step.approverRoleCode} onChange={(e) => updateStep(index, 'approverRoleCode', e.target.value.toUpperCase())} placeholder="Role code" /><input className={inputClass} value={step.approverUserId} onChange={(e) => updateStep(index, 'approverUserId', e.target.value)} placeholder="User UUID optional" /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={step.isRequired} onChange={(e) => updateStep(index, 'isRequired', e.target.checked)} />Required</label></div>)}</div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setStepPolicy(null)} className={modalButton}>Cancel</button><button type="button" disabled={busy} onClick={saveSteps} className={primaryButton}>Save Steps</button></div></Modal> : null}
  </div>;
}
