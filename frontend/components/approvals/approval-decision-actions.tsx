'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

type Action = 'approve' | 'reject' | 'cancel' | 'comment' | 'escalate';

const buttonBase = 'rounded-lg px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50';

export function ApprovalDecisionActions({ id, status, isEscalated }: { id: string; status: string; isEscalated?: boolean }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState('');

  async function run(action: Action) {
    setBusy(action);
    setError('');
    try {
      await api.post(`approvals/requests/${id}/${action}`, { note: note || undefined });
      setNote('');
      router.refresh();
    } catch (err: any) {
      setError(typeof err?.message === 'string' ? err.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Decision / Comment</h3>
      <textarea
        rows={4}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        className="mt-3 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
        placeholder="Decision note or internal comment..."
      />
      {error ? <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" disabled={busy !== null || !note.trim()} onClick={() => run('comment')} className={`${buttonBase} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>
          {busy === 'comment' ? '...' : 'Add Comment'}
        </button>
        {status === 'PENDING' ? (
          <>
            <button type="button" disabled={busy !== null} onClick={() => run('approve')} className={`${buttonBase} bg-emerald-600 text-white hover:bg-emerald-700`}>
              {busy === 'approve' ? '...' : 'Approve'}
            </button>
            <button type="button" disabled={busy !== null} onClick={() => run('reject')} className={`${buttonBase} bg-red-600 text-white hover:bg-red-700`}>
              {busy === 'reject' ? '...' : 'Reject'}
            </button>
            {!isEscalated ? (
              <button type="button" disabled={busy !== null} onClick={() => run('escalate')} className={`${buttonBase} border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100`}>
                {busy === 'escalate' ? '...' : 'Eskaloje'}
              </button>
            ) : null}
            <button type="button" disabled={busy !== null} onClick={() => run('cancel')} className={`${buttonBase} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>
              {busy === 'cancel' ? '...' : 'Cancel'}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
