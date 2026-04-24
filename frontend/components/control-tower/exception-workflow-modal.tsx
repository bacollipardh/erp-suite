'use client';

import { useEffect } from 'react';

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

const fieldClass =
  'box-border w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200';

const buttonClass =
  'rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';

export function ExceptionWorkflowModal({
  open,
  onClose,
  exceptionKey,
  currentStatus,
  note,
  setNote,
  assignedToId,
  setAssignedToId,
  snoozedUntil,
  setSnoozedUntil,
  history,
  historyOpen,
  onToggleHistory,
  onRunAction,
  busy,
  error,
}: {
  open: boolean;
  onClose: () => void;
  exceptionKey: string;
  currentStatus: string;
  note: string;
  setNote: (value: string) => void;
  assignedToId: string;
  setAssignedToId: (value: string) => void;
  snoozedUntil: string;
  setSnoozedUntil: (value: string) => void;
  history: WorkflowEvent[];
  historyOpen: boolean;
  onToggleHistory: () => void;
  onRunAction: (
    action: 'NOTE' | 'ASSIGN' | 'SNOOZE',
    extra?: Record<string, unknown>,
  ) => void;
  busy: string | null;
  error: string;
}) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Exception Workflow</h2>
            <p className="text-sm text-slate-500">Key: {exceptionKey} · Status: {currentStatus}</p>
          </div>

          <button type="button" onClick={onClose} className={buttonClass}>
            Close
          </button>
        </div>

        <div className="grid max-h-[calc(90vh-81px)] gap-6 overflow-auto p-6 md:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div className="rounded-xl border p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Add Note</h3>
              <div className="space-y-3">
                <textarea
                  rows={5}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  className={`${fieldClass} resize-none`}
                  placeholder="Shkruaj nje shenim te brendshem..."
                />
                <button
                  type="button"
                  disabled={busy !== null || !note.trim()}
                  onClick={() => onRunAction('NOTE', { note })}
                  className={buttonClass}
                >
                  {busy === 'NOTE' ? 'Duke ruajtur...' : 'Save Note'}
                </button>
              </div>
            </div>

            <div className="rounded-xl border p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Assign</h3>
              <div className="space-y-3">
                <input
                  value={assignedToId}
                  onChange={(event) => setAssignedToId(event.target.value)}
                  className={fieldClass}
                  placeholder="User UUID"
                />
                <button
                  type="button"
                  disabled={busy !== null || !assignedToId.trim()}
                  onClick={() => onRunAction('ASSIGN', { assignedToId, note: note || undefined })}
                  className={buttonClass}
                >
                  {busy === 'ASSIGN' ? 'Duke caktuar...' : 'Assign'}
                </button>
              </div>
            </div>

            <div className="rounded-xl border p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Snooze</h3>
              <div className="space-y-3">
                <input
                  type="datetime-local"
                  value={snoozedUntil}
                  onChange={(event) => setSnoozedUntil(event.target.value)}
                  className={fieldClass}
                />
                <button
                  type="button"
                  disabled={busy !== null || !snoozedUntil}
                  onClick={() =>
                    onRunAction('SNOOZE', {
                      snoozedUntil: new Date(snoozedUntil).toISOString(),
                      note: note || undefined,
                    })
                  }
                  className={buttonClass}
                >
                  {busy === 'SNOOZE' ? 'Duke ruajtur...' : 'Snooze'}
                </button>
              </div>
            </div>

            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-800">Workflow History</h3>
                <button type="button" onClick={onToggleHistory} className={buttonClass} disabled={busy !== null}>
                  {busy === 'HISTORY' ? 'Duke ngarkuar...' : historyOpen ? 'Hide History' : 'Load History'}
                </button>
              </div>

              {historyOpen ? (
                <div className="max-h-[55vh] space-y-3 overflow-auto pr-1">
                  {history.length === 0 ? <div className="text-sm text-slate-400">No history yet.</div> : null}
                  {history.map((event) => (
                    <div key={event.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="text-sm font-semibold text-slate-800">{event.action}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {formatDate(event.createdAt)} · {event.createdByName ?? 'System'}
                      </div>
                      {event.assignedToName ? (
                        <div className="mt-1 text-xs text-slate-600">Assigned: {event.assignedToName}</div>
                      ) : null}
                      {event.snoozedUntil ? (
                        <div className="mt-1 text-xs text-slate-600">Snoozed until: {formatDate(event.snoozedUntil)}</div>
                      ) : null}
                      {event.note ? <div className="mt-2 break-words text-sm text-slate-700">{event.note}</div> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-400">Kliko “Load History” per ta pare historikun.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
