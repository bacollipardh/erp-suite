'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { ExceptionWorkflowModal } from './exception-workflow-modal';

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
  const [modalOpen, setModalOpen] = useState(false);
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
      setHistoryOpen(true);
    } catch (err: any) {
      setError(typeof err?.message === 'string' ? err.message : 'History failed');
    } finally {
      setBusy(null);
    }
  }

  async function toggleHistory() {
    if (!historyOpen) {
      await loadHistory();
      return;
    }
    setHistoryOpen(false);
  }

  const current = status ?? 'OPEN';
  const quickActions: { label: string; action: QuickAction; show: boolean }[] = [
    { label: 'Ack', action: 'ACKNOWLEDGE', show: current === 'OPEN' },
    { label: 'Start', action: 'START', show: current === 'OPEN' || current === 'ACKNOWLEDGED' },
    { label: 'Resolve', action: 'RESOLVE', show: current !== 'RESOLVED' },
    { label: 'Reopen', action: 'REOPEN', show: current === 'RESOLVED' },
  ];

  return (
    <>
      <div className="flex w-56 flex-col gap-2">
        <div className="text-xs font-medium text-indigo-600">{current}</div>
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
          <button type="button" onClick={() => setModalOpen(true)} className={smallButtonClass}>
            More
          </button>
        </div>
        {error ? <span className="max-w-56 whitespace-normal break-words text-[11px] text-red-600">{error}</span> : null}
      </div>

      <ExceptionWorkflowModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        exceptionKey={exceptionKey}
        currentStatus={current}
        note={note}
        setNote={setNote}
        assignedToId={assignedToId}
        setAssignedToId={setAssignedToId}
        snoozedUntil={snoozedUntil}
        setSnoozedUntil={setSnoozedUntil}
        history={history}
        historyOpen={historyOpen}
        onToggleHistory={toggleHistory}
        onRunAction={run}
        busy={busy}
        error={error}
      />
    </>
  );
}
