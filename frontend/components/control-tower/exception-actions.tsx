'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

type Action = 'ACKNOWLEDGE' | 'START' | 'RESOLVE' | 'REOPEN';

export function ExceptionActions({
  exceptionKey,
  status,
}: {
  exceptionKey: string;
  status?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState('');

  async function run(action: Action) {
    setBusy(action);
    setError('');
    try {
      await api.post(`control-tower/exceptions/${encodeURIComponent(exceptionKey)}/actions`, { action });
      router.refresh();
    } catch (err: any) {
      setError(typeof err?.message === 'string' ? err.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  }

  const current = status ?? 'OPEN';
  const actions: { label: string; action: Action; show: boolean }[] = [
    { label: 'Ack', action: 'ACKNOWLEDGE', show: current === 'OPEN' },
    { label: 'Start', action: 'START', show: current === 'OPEN' || current === 'ACKNOWLEDGED' },
    { label: 'Resolve', action: 'RESOLVE', show: current !== 'RESOLVED' },
    { label: 'Reopen', action: 'REOPEN', show: current === 'RESOLVED' },
  ];

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-1">
        {actions.filter((entry) => entry.show).map((entry) => (
          <button
            key={entry.action}
            type="button"
            onClick={() => run(entry.action)}
            disabled={busy !== null}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {busy === entry.action ? '...' : entry.label}
          </button>
        ))}
      </div>
      {error ? <span className="max-w-56 whitespace-normal text-[11px] text-red-600">{error}</span> : null}
    </div>
  );
}
