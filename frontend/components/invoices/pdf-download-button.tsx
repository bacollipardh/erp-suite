'use client';

import { useState } from 'react';
import { getClientToken } from '@/lib/auth-utils';

async function fetchPdfBlob(href: string): Promise<Blob> {
  const token = getClientToken();
  const res = await fetch(href, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('Gjenerimi i PDF-it dështoi');
  return res.blob();
}

export function PdfButtons({ baseHref, docNo }: { baseHref: string; docNo: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePreview() {
    setLoading(true);
    setError(null);
    try {
      const blob = await fetchPdfBlob(`${baseHref}?mode=preview`);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Keep URL alive for 60s so the tab can load it
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err: any) {
      setError(err.message ?? 'Gabim');
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload() {
    setLoading(true);
    setError(null);
    try {
      const blob = await fetchPdfBlob(baseHref);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${docNo}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message ?? 'Gabim');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          onClick={handlePreview}
          disabled={loading}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {loading ? 'Duke gjeneruar...' : '👁 Shiko PDF'}
        </button>
        <button
          onClick={handleDownload}
          disabled={loading}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          ⬇ Shkarko PDF
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

/** @deprecated Use PdfButtons instead */
export function PdfDownloadButton({ href, label }: { href: string; label: string }) {
  return <PdfButtons baseHref={href} docNo="document" />;
}
