'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

type Step = {
  id: string;
  stepNo: number;
  approverRoleCode: string | null;
  approverUserId: string | null;
  approverUserName?: string | null;
  label: string | null;
  isRequired: boolean;
};

type Row = {
  stepNo: number;
  approverRoleCode: string;
  approverUserId: string;
  label: string;
  isRequired: boolean;
};

const inputClass = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200';

function fromStep(step: Step): Row {
  return {
    stepNo: step.stepNo,
    approverRoleCode: step.approverRoleCode ?? '',
    approverUserId: step.approverUserId ?? '',
    label: step.label ?? `Step ${step.stepNo}`,
    isRequired: step.isRequired,
  };
}

export function PolicyStepsPanel({ policyId, steps }: { policyId: string; steps: Step[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(steps.map(fromStep));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function setValue(index: number, key: keyof Row, value: string | number | boolean) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)));
  }

  async function save() {
    setBusy(true);
    setError('');
    try {
      await api.update('approvals/policies', `${policyId}/steps`, {
        steps: rows.map((row) => ({
          stepNo: row.stepNo,
          approverRoleCode: row.approverRoleCode.trim() || null,
          approverUserId: row.approverUserId.trim() || null,
          label: row.label.trim() || `Step ${row.stepNo}`,
          isRequired: row.isRequired,
        })),
      });
      router.refresh();
    } catch (err: any) {
      setError(typeof err?.message === 'string' ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b pb-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Policy Approval Steps</h2>
          <p className="text-xs text-slate-500">Vendos approver role ose approver user për çdo hap.</p>
        </div>
        <button type="button" disabled={busy} onClick={save} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save Steps</button>
      </div>

      {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">Step</th>
              <th className="px-3 py-2">Label</th>
              <th className="px-3 py-2">Approver Role Code</th>
              <th className="px-3 py-2">Approver User UUID</th>
              <th className="px-3 py-2">Required</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => (
              <tr key={row.stepNo} className="align-top">
                <td className="px-3 py-3 font-semibold text-slate-900">{row.stepNo}</td>
                <td className="px-3 py-3"><input className={inputClass} value={row.label} onChange={(e) => setValue(index, 'label', e.target.value)} /></td>
                <td className="px-3 py-3"><input className={inputClass} value={row.approverRoleCode} placeholder="ADMIN / FINANCE_MANAGER" onChange={(e) => setValue(index, 'approverRoleCode', e.target.value.toUpperCase())} /></td>
                <td className="px-3 py-3"><input className={inputClass} value={row.approverUserId} placeholder="Optional user UUID" onChange={(e) => setValue(index, 'approverUserId', e.target.value)} /></td>
                <td className="px-3 py-3"><input type="checkbox" checked={row.isRequired} onChange={(e) => setValue(index, 'isRequired', e.target.checked)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
