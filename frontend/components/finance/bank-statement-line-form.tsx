'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { toDateInputValue } from '@/lib/date';

type FinanceAccountOption = {
  id: string;
  code: string;
  name: string;
  accountType: 'CASH' | 'BANK';
  currentBalance: number;
  currencyCode?: string | null;
  bankName?: string | null;
  bankAccountNo?: string | null;
};

function formatMoney(value?: number | string | null) {
  return Number(value ?? 0).toLocaleString('sq-AL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseApiError(error: unknown) {
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message);
      if (typeof parsed.message === 'string') return parsed.message;
    } catch {}
    return error.message;
  }

  return 'Ndodhi nje gabim gjate ruajtjes se levizjes bankare.';
}

export function BankStatementLineForm({
  accounts,
}: {
  accounts: FinanceAccountOption[];
}) {
  const router = useRouter();
  const [financeAccountId, setFinanceAccountId] = useState(accounts[0]?.id ?? '');
  const [direction, setDirection] = useState<'IN' | 'OUT'>('IN');
  const [amount, setAmount] = useState('');
  const [statementDate, setStatementDate] = useState(toDateInputValue(new Date()));
  const [valueDate, setValueDate] = useState('');
  const [statementBalance, setStatementBalance] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [externalId, setExternalId] = useState('');
  const [counterpartyName, setCounterpartyName] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === financeAccountId) ?? null,
    [accounts, financeAccountId],
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await api.post('finance-reconciliation/statement-lines', {
        financeAccountId,
        direction,
        amount: Number(amount),
        statementDate,
        valueDate: valueDate || undefined,
        statementBalance: statementBalance === '' ? undefined : Number(statementBalance),
        referenceNo: referenceNo || undefined,
        externalId: externalId || undefined,
        counterpartyName: counterpartyName || undefined,
        description: description || undefined,
        notes: notes || undefined,
      });

      router.push('/financa/pajtimi-bankar');
      router.refresh();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Llogaria bankare</span>
          <select
            value={financeAccountId}
            onChange={(event) => setFinanceAccountId(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            required
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.code} - {account.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Drejtimi</span>
          <select
            value={direction}
            onChange={(event) => setDirection(event.target.value as 'IN' | 'OUT')}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="IN">Hyrje ne banke</option>
            <option value="OUT">Dalje nga banka</option>
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Shuma</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            required
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Data e statement-it</span>
          <input
            type="date"
            value={statementDate}
            onChange={(event) => setStatementDate(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            required
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Data e vleres</span>
          <input
            type="date"
            value={valueDate}
            onChange={(event) => setValueDate(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Balanca ne statement</span>
          <input
            type="number"
            step="0.01"
            value={statementBalance}
            onChange={(event) => setStatementBalance(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Reference bankare</span>
          <input
            value={referenceNo}
            onChange={(event) => setReferenceNo(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">ID ekstern</span>
          <input
            value={externalId}
            onChange={(event) => setExternalId(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Pala</span>
          <input
            value={counterpartyName}
            onChange={(event) => setCounterpartyName(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Pershkrimi</span>
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      {selectedAccount ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <p>
            Bilanci aktual ne sistem:{' '}
            <span className="font-semibold">
              {formatMoney(selectedAccount.currentBalance)} {selectedAccount.currencyCode ?? 'EUR'}
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {selectedAccount.bankName || selectedAccount.bankAccountNo
              ? [selectedAccount.bankName, selectedAccount.bankAccountNo].filter(Boolean).join(' | ')
              : 'Llogari bankare pa detaje shtese.'}
          </p>
        </div>
      ) : null}

      <label className="space-y-1.5 block">
        <span className="text-sm font-medium text-slate-700">Shenime</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={4}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? 'Duke ruajtur...' : 'Ruaj levizjen bankare'}
        </button>
      </div>
    </form>
  );
}
