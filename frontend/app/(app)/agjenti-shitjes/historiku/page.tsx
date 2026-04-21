import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';
import { PdfButtons } from '@/components/invoices/pdf-download-button';
import Link from 'next/link';

function formatDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('sq-AL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    DRAFT:    { label: 'Draft',   cls: 'bg-slate-100 text-slate-600' },
    POSTED:   { label: 'Postuar', cls: 'bg-emerald-100 text-emerald-700' },
    CANCELLED:{ label: 'Anuluar', cls: 'bg-red-100 text-red-600' },
  };
  const s = map[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600' };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

export default async function SalesHistoryPage() {
  await requirePagePermission(PERMISSIONS.salesInvoicesRead);
  const invoices: any[] = await api.list('sales-invoices', { limit: 100 });

  const sorted = [...invoices].sort(
    (a, b) => new Date(b.createdAt ?? b.docDate ?? 0).getTime()
            - new Date(a.createdAt ?? a.docDate ?? 0).getTime()
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Historiku i Shitjeve</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Të gjitha faturat e shitjes të krijuara nga agjenti.
          </p>
        </div>
        <Link
          href="/agjenti-shitjes"
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-sm font-medium transition-colors shadow-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Faturë e Re
        </Link>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-400">
          Nuk ka fatura shitjeje akoma.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Nr. Dokumentit</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Klienti</th>
                  <th className="px-4 py-3">Magazina</th>
                  <th className="px-4 py-3 text-right">Neto</th>
                  <th className="px-4 py-3 text-right">TVSH</th>
                  <th className="px-4 py-3 text-right">Bruto</th>
                  <th className="px-4 py-3">Statusi</th>
                  <th className="px-4 py-3 text-right">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-slate-800">
                      {inv.docNo ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {formatDate(inv.docDate ?? inv.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {inv.customer?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {inv.warehouse?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {Number(inv.subtotal ?? 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                      {Number(inv.taxTotal ?? 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">
                      {Number(inv.grandTotal ?? 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={inv.status ?? 'DRAFT'} />
                    </td>
                    <td className="px-4 py-3">
                      <PdfButtons
                        baseHref={`/api/proxy/pdf/sales-invoices/${inv.id}`}
                        docNo={inv.docNo ?? `inv-${inv.id}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
