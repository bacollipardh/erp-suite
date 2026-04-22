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

  return 'Ndodhi nje gabim gjate ruajtjes se transferit.';
}

export function FinanceTransferForm({
  accounts,
}: {
  accounts: FinanceAccountOption[];
}) {
  const router = useRouter();
  const [sourceAccountId, setSourceAccountId] = useState(accounts[0]?.id ?? '');
  const [destinationAccountId, setDestinationAccountId] = useState(accounts[1]?.id ?? accounts[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [transactionDate, setTransactionDate] = useState(toDateInputValue(new Date()));
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sourceAccount = useMemo(
    () => accounts.find((account) => account.id === sourceAccountId) ?? null,
    [accounts, sourceAccountId],
  );

  const destinationAccount = useMemo(
    () => accounts.find((account) => account.id === destinationAccountId) ?? null,
    [accounts, destinationAccountId],
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await api.post('finance-accounts/transfers', {
        sourceAccountId,
        destinationAccountId,
        amount: Number(amount),
        transactionDate,
        referenceNo: referenceNo || undefined,
        notes: notes || undefined,
      });

      router.push('/financa/llogarite');
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
          <span className="text-sm font-medium text-slate-700">Nga llogaria</span>
          <select
            value={sourceAccountId}
            onChange={(event) => setSourceAccountId(event.target.value)}
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
          <span className="text-sm font-medium text-slate-700">Ne llogarine</span>
          <select
            value={destinationAccountId}
            onChange={(event) => setDestinationAccountId(event.target.value)}
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
          <span className="text-sm font-medium text-slate-700">Data</span>
          <input
            type="date"
            value={transactionDate}
            onChange={(event) => setTransactionDate(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Reference</span>
          <input
            value={referenceNo}
            onChange={(event) => setReferenceNo(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sourceAccount ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Bilanci aktual ne dalje: <span className="font-semibold">{formatMoney(sourceAccount.currentBalance)} {sourceAccount.currencyCode ?? 'EUR'}</span>
          </div>
        ) : null}

        {destinationAccount ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Bilanci aktual ne hyrje: <span className="font-semibold">{formatMoney(destinationAccount.currentBalance)} {destinationAccount.currencyCode ?? 'EUR'}</span>
          </div>
        ) : null}
      </div>

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
          {busy ? 'Duke ruajtur...' : 'Ruaj transferin'}
        </button>
      </div>
    </form>
  );
}
