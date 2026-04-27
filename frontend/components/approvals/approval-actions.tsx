'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

type ApprovalAction = 'approve' | 'reject' | 'cancel';

const buttonBase = 'rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50';

export function ApprovalActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<ApprovalAction | null>(null);
  const [error, setError] = useState('');

  async function run(action: ApprovalAction) {
    const note = action === 'approve' ? 'Approved from Approval Inbox' : `${action} from Approval Inbox`;
    setBusy(action);
    setError('');
    try {
      await api.post(`approvals/requests/${id}/${action}`, { note });
      router.refresh();
    } catch (err: any) {
      setError(typeof err?.message === 'string' ? err.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  }

  if (status !== 'PENDING') {
    return <span className="text-xs text-slate-400">No action</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-1">
        <button type="button" disabled={busy !== null} onClick={() => run('approve')} className={`${buttonBase} bg-emerald-600 text-white hover:bg-emerald-700`}>
          {busy === 'approve' ? '...' : 'Approve'}
        </button>
        <button type="button" disabled={busy !== null} onClick={() => run('reject')} className={`${buttonBase} bg-red-600 text-white hover:bg-red-700`}>
          {busy === 'reject' ? '...' : 'Reject'}
        </button>
        <button type="button" disabled={busy !== null} onClick={() => run('cancel')} className={`${buttonBase} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>
          {busy === 'cancel' ? '...' : 'Cancel'}
        </button>
      </div>
      {error ? <div className="max-w-72 break-words text-[11px] text-red-600">{error}</div> : null}
    </div>
  );
}
