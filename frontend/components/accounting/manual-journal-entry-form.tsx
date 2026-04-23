'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { toDateInputValue } from '@/lib/date';

type ManualLedgerAccount = {
  id: string;
  code: string;
  name: string;
  reportSectionLabel: string;
};

type JournalLineState = {
  key: string;
  accountId: string;
  side: 'DEBIT' | 'CREDIT';
  amount: string;
  description: string;
  partyName: string;
};

function parseApiError(error: unknown) {
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message);
      if (typeof parsed.message === 'string') return parsed.message;
    } catch {}
    return error.message;
  }

  return 'Ndodhi nje gabim gjate ruajtjes se journal entry.';
}

function createLine(side: 'DEBIT' | 'CREDIT' = 'DEBIT'): JournalLineState {
  return {
    key: `${Date.now()}-${Math.random()}`,
    accountId: '',
    side,
    amount: '',
    description: '',
    partyName: '',
  };
}

function fmtMoney(value: number) {
  return `${value.toLocaleString('sq-AL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} EUR`;
}

export function ManualJournalEntryForm({
  accounts,
}: {
  accounts: ManualLedgerAccount[];
}) {
  const router = useRouter();
  const [entryDate, setEntryDate] = useState(toDateInputValue(new Date()));
  const [description, setDescription] = useState('');
  const [sourceNo, setSourceNo] = useState('');
  const [lines, setLines] = useState<JournalLineState[]>([
    createLine('DEBIT'),
    createLine('CREDIT'),
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => {
    const debit = lines
      .filter((line) => line.side === 'DEBIT')
      .reduce((sum, line) => sum + Number(line.amount || 0), 0);
    const credit = lines
      .filter((line) => line.side === 'CREDIT')
      .reduce((sum, line) => sum + Number(line.amount || 0), 0);

    return {
      debit,
      credit,
      difference: debit - credit,
      balanced: Math.abs(debit - credit) < 0.0001,
    };
  }, [lines]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      if (!description.trim()) {
        throw new Error('Pershkrimi eshte i detyrueshem.');
      }

      if (lines.length < 2) {
        throw new Error('Journal entry duhet te kete se paku dy rreshta.');
      }

      if (
        lines.some(
          (line) =>
            !line.accountId || Number(line.amount || 0) <= 0 || !['DEBIT', 'CREDIT'].includes(line.side),
        )
      ) {
        throw new Error('Ploteso cdo rresht me konto, ane dhe shume valide.');
      }

      if (!totals.balanced) {
        throw new Error('Journal entry duhet te jete i balancuar.');
      }

      await api.post('accounting/journal-entries', {
        entryDate,
        description: description.trim(),
        sourceNo: sourceNo.trim() || undefined,
        lines: lines.map((line) => ({
          accountId: line.accountId,
          side: line.side,
          amount: Number(line.amount || 0),
          description: line.description.trim() || undefined,
          partyName: line.partyName.trim() || undefined,
        })),
      });

      router.push('/financa/libri-kontabel');
      router.refresh();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  function updateLine(key: string, patch: Partial<JournalLineState>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function removeLine(key: string) {
    setLines((current) => (current.length <= 2 ? current : current.filter((line) => line.key !== key)));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Data e journal-it</span>
          <input
            type="date"
            value={entryDate}
            onChange={(event) => setEntryDate(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            required
          />
        </label>

        <label className="space-y-1.5 md:col-span-2">
          <span className="text-sm font-medium text-slate-700">Pershkrimi</span>
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="p.sh. Accrual i shpenzimit mujor"
            required
          />
        </label>

        <label className="space-y-1.5 md:col-span-3">
          <span className="text-sm font-medium text-slate-700">Reference / Source No</span>
          <input
            value={sourceNo}
            onChange={(event) => setSourceNo(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Opsionale"
          />
        </label>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Rreshtat e journal-it</h2>
            <p className="mt-1 text-xs text-slate-500">
              Lejohen vetem konto manuale si accruals, prepaid, VAT adjustments, other income dhe other expense.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLines((current) => [...current, createLine('DEBIT')])}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
          >
            Shto rresht
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {lines.map((line, index) => (
            <div key={line.key} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">Rreshti {index + 1}</p>
                <button
                  type="button"
                  onClick={() => removeLine(line.key)}
                  disabled={lines.length <= 2}
                  className="text-xs font-medium text-red-600 disabled:opacity-40"
                >
                  Largo
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                <label className="space-y-1.5 xl:col-span-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Konto
                  </span>
                  <select
                    value={line.accountId}
                    onChange={(event) => updateLine(line.key, { accountId: event.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    required
                  >
                    <option value="">Zgjidh konton</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.code} - {account.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Ana
                  </span>
                  <select
                    value={line.side}
                    onChange={(event) =>
                      updateLine(line.key, { side: event.target.value as 'DEBIT' | 'CREDIT' })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="DEBIT">Debit</option>
                    <option value="CREDIT">Credit</option>
                  </select>
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Shuma
                  </span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={line.amount}
                    onChange={(event) => updateLine(line.key, { amount: event.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    required
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Pala
                  </span>
                  <input
                    value={line.partyName}
                    onChange={(event) => updateLine(line.key, { partyName: event.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Opsionale"
                  />
                </label>

                <label className="space-y-1.5 md:col-span-2 xl:col-span-5">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Pershkrimi i rreshtit
                  </span>
                  <input
                    value={line.description}
                    onChange={(event) => updateLine(line.key, { description: event.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Opsionale"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Debit total</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{fmtMoney(totals.debit)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Credit total</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{fmtMoney(totals.credit)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Diferenca</p>
          <p
            className={`mt-1 text-xl font-semibold ${
              totals.balanced ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {fmtMoney(Math.abs(totals.difference))}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {totals.balanced ? 'Journal entry eshte i balancuar.' : 'Duhet balancuar para ruajtjes.'}
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push('/financa/libri-kontabel')}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
        >
          Anulo
        </button>
        <button
          type="submit"
          disabled={busy || accounts.length === 0}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? 'Duke ruajtur...' : 'Ruaj journal entry'}
        </button>
      </div>
    </form>
  );
}
