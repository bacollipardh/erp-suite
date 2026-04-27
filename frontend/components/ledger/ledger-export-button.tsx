'use client';

import { useState } from 'react';
import { buildLedgerCsv, buildLedgerFilename, triggerCsvDownload } from '@/lib/report-export';

type Props = {
  type: 'customer' | 'supplier';
  partyId: string;
  dateFrom: string;
  dateTo: string;
};

export function LedgerExportButton({ type, partyId, dateFrom, dateTo }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setLoading(true);
    setError(null);
    try {
      const endpoint =
        type === 'customer' ? '/api/proxy/statements/customers/ledger' : '/api/proxy/statements/suppliers/ledger';
      const partyKey = type === 'customer' ? 'customerId' : 'supplierId';
      const params = new URLSearchParams({ limit: '2000' });
      if (partyId) params.set(partyKey, partyId);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await fetch(`${endpoint}?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Gabim gjatë shkarkimit: ${res.status}`);
      const data = await res.json();
      triggerCsvDownload(buildLedgerFilename(type), buildLedgerCsv(data));
    } catch (err: any) {
      setError(typeof err.message === 'string' ? err.message : 'Eksporti dështoi');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
      <button
        onClick={handleExport}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.8}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
          />
        </svg>
        {loading ? 'Duke eksportuar...' : 'Eksporto CSV'}
      </button>
    </div>
  );
}
