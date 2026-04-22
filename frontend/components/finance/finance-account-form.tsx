'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { toDateInputValue } from '@/lib/date';

function parseApiError(error: unknown) {
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message);
      if (typeof parsed.message === 'string') return parsed.message;
    } catch {}
    return error.message;
  }

  return 'Ndodhi nje gabim gjate ruajtjes se llogarise.';
}

export function FinanceAccountForm() {
  const router = useRouter();
  const [accountType, setAccountType] = useState<'CASH' | 'BANK'>('BANK');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [currencyCode, setCurrencyCode] = useState('EUR');
  const [bankName, setBankName] = useState('');
  const [bankAccountNo, setBankAccountNo] = useState('');
  const [iban, setIban] = useState('');
  const [swiftCode, setSwiftCode] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [openingDate, setOpeningDate] = useState(toDateInputValue(new Date()));
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await api.post('finance-accounts', {
        code,
        name,
        accountType,
        currencyCode,
        bankName: accountType === 'BANK' ? bankName || undefined : undefined,
        bankAccountNo: accountType === 'BANK' ? bankAccountNo || undefined : undefined,
        iban: accountType === 'BANK' ? iban || undefined : undefined,
        swiftCode: accountType === 'BANK' ? swiftCode || undefined : undefined,
        openingBalance: Number(openingBalance || 0),
        openingDate: openingDate || undefined,
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
          <span className="text-sm font-medium text-slate-700">Kodi</span>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="p.sh. BANK_MAIN"
            required
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Emri</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Llogaria kryesore bankare"
            required
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Tipi</span>
          <select
            value={accountType}
            onChange={(event) => setAccountType(event.target.value as 'CASH' | 'BANK')}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="BANK">Banke</option>
            <option value="CASH">Cash</option>
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Valuta</span>
          <input
            value={currencyCode}
            onChange={(event) => setCurrencyCode(event.target.value.toUpperCase())}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            maxLength={10}
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Balanca hapese</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={openingBalance}
            onChange={(event) => setOpeningBalance(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Data e hapjes</span>
          <input
            type="date"
            value={openingDate}
            onChange={(event) => setOpeningDate(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      {accountType === 'BANK' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Banka</span>
            <input
              value={bankName}
              onChange={(event) => setBankName(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Nr. llogarise</span>
            <input
              value={bankAccountNo}
              onChange={(event) => setBankAccountNo(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-slate-700">IBAN</span>
            <input
              value={iban}
              onChange={(event) => setIban(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-slate-700">SWIFT</span>
            <input
              value={swiftCode}
              onChange={(event) => setSwiftCode(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
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
          {busy ? 'Duke ruajtur...' : 'Ruaj llogarine'}
        </button>
      </div>
    </form>
  );
}
