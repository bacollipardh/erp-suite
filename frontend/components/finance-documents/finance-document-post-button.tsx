'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export function FinanceDocumentPostButton({
  endpoint,
  id,
  disabled,
}: {
  endpoint: string;
  id: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function postDocument() {
    if (disabled || busy) return;
    setBusy(true);
    setError('');
    try {
      await api.postDocument(endpoint, id);
      router.refresh();
    } catch (err: any) {
      setError(typeof err?.message === 'string' ? err.message : 'Postimi deshtoi');
    } finally {
      setBusy(false);
    }
  }

  if (disabled) {
    return <span className="text-xs text-slate-400">-</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={postDocument}
        disabled={busy}
        className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
      >
        {busy ? 'Duke postuar...' : 'Posto'}
      </button>
      {error ? <span className="max-w-48 whitespace-normal text-[11px] text-red-600">{error}</span> : null}
    </div>
  );
}
