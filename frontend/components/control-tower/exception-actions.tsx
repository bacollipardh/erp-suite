'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

type QuickAction = 'ACKNOWLEDGE' | 'START' | 'RESOLVE' | 'REOPEN';
type AdvancedAction = 'ASSIGN' | 'SNOOZE' | 'NOTE';
type WorkflowEvent = {
  id: string;
  action: string;
  note?: string | null;
  assignedToName?: string | null;
  snoozedUntil?: string | null;
  createdByName?: string | null;
  createdAt?: string | null;
};

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('sq-XK') : '-';
}

const fieldClass = 'box-border w-full max-w-full rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-300';
const smallButtonClass = 'rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';

export function ExceptionActions({
  exceptionKey,
  status,
}: {
  exceptionKey: string;
  status?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [openAdvanced, setOpenAdvanced] = useState(false);
  const [note, setNote] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [snoozedUntil, setSnoozedUntil] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<WorkflowEvent[]>([]);

  async function run(action: QuickAction | AdvancedAction, extra?: Record<string, unknown>) {
    setBusy(action);
    setError('');
    try {
      await api.post(`control-tower/exceptions/${encodeURIComponent(exceptionKey)}/actions`, { action, ...extra });
      router.refresh();
    } catch (err: any) {
      setError(typeof err?.message === 'string' ? err.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  }

  async function loadHistory() {
    setBusy('HISTORY');
    setError('');
    try {
      const result = await api.getOne<{ items: WorkflowEvent[] }>(`control-tower/exceptions/${encodeURIComponent(exceptionKey)}/events`);
      setHistory(result.items ?? []);
      setHistoryOpen((value) => !value);
    } catch (err: any) {
      setError(typeof err?.message === 'string' ? err.message : 'History failed');
    } finally {
      setBusy(null);
    }
  }

  const current = status ?? 'OPEN';
  const quickActions: { label: string; action: QuickAction; show: boolean }[] = [
    { label: 'Ack', action: 'ACKNOWLEDGE', show: current === 'OPEN' },
    { label: 'Start', action: 'START', show: current === 'OPEN' || current === 'ACKNOWLEDGED' },
    { label: 'Resolve', action: 'RESOLVE', show: current !== 'RESOLVED' },
    { label: 'Reopen', action: 'REOPEN', show: current === 'RESOLVED' },
  ];

  return (
    <div className="flex w-72 max-w-72 flex-col gap-2">
      <div className="flex flex-wrap gap-1">
        {quickActions.filter((entry) => entry.show).map((entry) => (
          <button
            key={entry.action}
            type="button"
            onClick={() => run(entry.action)}
            disabled={busy !== null}
            className={smallButtonClass}
          >
            {busy === entry.action ? '...' : entry.label}
          </button>
        ))}
        <button type="button" onClick={() => setOpenAdvanced((value) => !value)} className={smallButtonClass}>
          More
        </button>
        <button type="button" onClick={loadHistory} disabled={busy !== null} className={smallButtonClass}>
          {busy === 'HISTORY' ? '...' : 'History'}
        </button>
      </div>

      {openAdvanced ? (
        <div className="w-72 max-w-72 rounded-lg border bg-white p-2 shadow-sm space-y-2">
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-slate-500">Add note</label>
            <textarea
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className={`${fieldClass} resize-none`}
              placeholder="Internal note"
            />
            <button type="button" disabled={busy !== null || !note.trim()} onClick={() => run('NOTE', { note })} className={smallButtonClass}>Save Note</button>
          </div>
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-slate-500">Assign to user ID</label>
            <input value={assignedToId} onChange={(event) => setAssignedToId(event.target.value)} className={fieldClass} placeholder="User UUID" />
            <button type="button" disabled={busy !== null || !assignedToId.trim()} onClick={() => run('ASSIGN', { assignedToId, note: note || undefined })} className={smallButtonClass}>Assign</button>
          </div>
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-slate-500">Snooze until</label>
            <input type="datetime-local" value={snoozedUntil} onChange={(event) => setSnoozedUntil(event.target.value)} className={fieldClass} />
            <button type="button" disabled={busy !== null || !snoozedUntil} onClick={() => run('SNOOZE', { snoozedUntil: new Date(snoozedUntil).toISOString(), note: note || undefined })} className={smallButtonClass}>Snooze</button>
          </div>
        </div>
      ) : null}

      {historyOpen ? (
        <div className="w-72 max-w-72 max-h-48 overflow-auto rounded-lg border bg-white p-2 shadow-sm">
          {history.length === 0 ? <div className="text-xs text-slate-400">No history yet.</div> : null}
          {history.map((event) => (
            <div key={event.id} className="border-b py-1 last:border-b-0">
              <div className="text-xs font-semibold text-slate-700">{event.action}</div>
              <div className="text-[11px] text-slate-500">{formatDate(event.createdAt)} · {event.createdByName ?? 'System'}</div>
              {event.assignedToName ? <div className="text-[11px] text-slate-500">Assigned: {event.assignedToName}</div> : null}
              {event.snoozedUntil ? <div className="text-[11px] text-slate-500">Snoozed: {formatDate(event.snoozedUntil)}</div> : null}
              {event.note ? <div className="break-words text-[11px] text-slate-600">{event.note}</div> : null}
            </div>
          ))}
        </div>
      ) : null}

      {error ? <span className="max-w-72 whitespace-normal break-words text-[11px] text-red-600">{error}</span> : null}
    </div>
  );
}
