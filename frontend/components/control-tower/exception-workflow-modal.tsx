'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type WorkflowEvent = {
  id: string;
  action: string;
  note?: string | null;
  assignedToName?: string | null;
  snoozedUntil?: string | null;
  createdByName?: string | null;
  createdAt?: string | null;
};

type UserOption = {
  id: string;
  fullName?: string | null;
  email?: string | null;
};

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('sq-XK') : '-';
}

function statusTone(status: string) {
  switch (status) {
    case 'RESOLVED':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    case 'IN_PROGRESS':
      return 'bg-blue-50 text-blue-700 ring-blue-200';
    case 'ACKNOWLEDGED':
      return 'bg-amber-50 text-amber-700 ring-amber-200';
    case 'SNOOZED':
      return 'bg-violet-50 text-violet-700 ring-violet-200';
    default:
      return 'bg-slate-50 text-slate-700 ring-slate-200';
  }
}

const fieldClass =
  'box-border w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200';

const primaryButtonClass =
  'inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50';

const secondaryButtonClass =
  'inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';

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
  const [users, setUsers] = useState<UserOption[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || users.length > 0 || usersLoading) return;

    setUsersLoading(true);
    setUsersError('');
    api.list<UserOption>('users', { limit: 200, sortBy: 'fullName', sortOrder: 'asc' })
      .then((items) => setUsers(items))
      .catch(() => setUsersError('Users could not be loaded.'))
      .finally(() => setUsersLoading(false));
  }, [open, users.length, usersLoading]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl">
        <div className="flex flex-col gap-4 border-b border-slate-200 bg-white px-6 py-5 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-slate-900">Exception Workflow</h2>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusTone(currentStatus)}`}>
                {currentStatus}
              </span>
            </div>
            <p className="break-all text-sm text-slate-500">Key: {exceptionKey}</p>
          </div>

          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Close
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-6 overflow-hidden p-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-h-0 overflow-auto pr-1">
            <div className="grid gap-4 xl:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-slate-900">Add Note</h3>
                  <p className="mt-1 text-xs text-slate-500">Ruaj nje koment te brendshem per kete exception.</p>
                </div>

                <div className="space-y-3">
                  <textarea
                    rows={5}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    className={`${fieldClass} resize-none`}
                    placeholder="Shkruaj nje shenim te brendshem..."
                  />

                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={busy !== null || !note.trim()}
                      onClick={() => onRunAction('NOTE', { note })}
                      className={primaryButtonClass}
                    >
                      {busy === 'NOTE' ? 'Duke ruajtur...' : 'Save Note'}
                    </button>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-slate-900">Assign</h3>
                  <p className="mt-1 text-xs text-slate-500">Zgjedh perdoruesin qe do ta ndjeke kete exception.</p>
                </div>

                <div className="space-y-3">
                  <select
                    value={assignedToId}
                    onChange={(event) => setAssignedToId(event.target.value)}
                    className={fieldClass}
                    disabled={usersLoading}
                  >
                    <option value="">{usersLoading ? 'Loading users...' : 'Select user'}</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.fullName || user.email || user.id}{user.email ? ` — ${user.email}` : ''}
                      </option>
                    ))}
                  </select>

                  {usersError ? <div className="text-xs text-red-600">{usersError}</div> : null}

                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={busy !== null || !assignedToId.trim()}
                      onClick={() => onRunAction('ASSIGN', { assignedToId, note: note || undefined })}
                      className={primaryButtonClass}
                    >
                      {busy === 'ASSIGN' ? 'Duke caktuar...' : 'Assign'}
                    </button>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-slate-900">Snooze</h3>
                  <p className="mt-1 text-xs text-slate-500">Shtyje trajtimin deri ne nje kohe te caktuar.</p>
                </div>

                <div className="space-y-3">
                  <input
                    type="datetime-local"
                    value={snoozedUntil}
                    onChange={(event) => setSnoozedUntil(event.target.value)}
                    className={fieldClass}
                  />

                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={busy !== null || !snoozedUntil}
                      onClick={() =>
                        onRunAction('SNOOZE', {
                          snoozedUntil: new Date(snoozedUntil).toISOString(),
                          note: note || undefined,
                        })
                      }
                      className={primaryButtonClass}
                    >
                      {busy === 'SNOOZE' ? 'Duke ruajtur...' : 'Snooze'}
                    </button>
                  </div>
                </div>
              </section>
            </div>

            {error ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}
          </div>

          <aside className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Workflow History</h3>
                <p className="mt-1 text-xs text-slate-500">Ngjarjet me te fundit te ketij exception-i.</p>
              </div>

              <button type="button" onClick={onToggleHistory} className={secondaryButtonClass} disabled={busy !== null}>
                {busy === 'HISTORY' ? 'Duke ngarkuar...' : historyOpen ? 'Hide' : 'Load'}
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-4">
              {!historyOpen ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
                  Kliko Load per ta pare historikun.
                </div>
              ) : history.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
                  No history yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((event) => (
                    <article key={event.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{event.action}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {formatDate(event.createdAt)} · {event.createdByName ?? 'System'}
                          </div>
                        </div>
                      </div>

                      {event.assignedToName ? (
                        <div className="mt-3 text-xs text-slate-600">
                          <span className="font-medium text-slate-700">Assigned:</span> {event.assignedToName}
                        </div>
                      ) : null}

                      {event.snoozedUntil ? (
                        <div className="mt-2 text-xs text-slate-600">
                          <span className="font-medium text-slate-700">Snoozed until:</span> {formatDate(event.snoozedUntil)}
                        </div>
                      ) : null}

                      {event.note ? (
                        <div className="mt-3 rounded-lg bg-white px-3 py-2 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200">
                          {event.note}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
