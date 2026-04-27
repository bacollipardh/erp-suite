import { PageHeader } from '@/components/page-header';
import { FinanceDocumentPostButton } from '@/components/finance-documents/finance-document-post-button';
import { StatusBadge } from '@/components/status-badge';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

type Receipt = {
  id: string;
  docNo: string;
  docDate: string;
  status: string;
  enteredAmount: number;
  appliedAmount: number;
  unappliedAmount: number;
  referenceNo?: string | null;
  customer?: { name?: string };
  financeAccount?: { code?: string; name?: string };
};

function money(value: number) {
  return new Intl.NumberFormat('sq-XK', { style: 'currency', currency: 'EUR' }).format(Number(value ?? 0));
}

function date(value: string) {
  return value ? new Date(value).toLocaleDateString('sq-XK') : '-';
}

export default async function Page() {
  await requirePagePermission(PERMISSIONS.salesInvoicesPay);
  const receipts = await api.list<Receipt>('customer-receipts');

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dokumente Arketimi"
        description="Dokumente formale financiare per arketimet cash/bank dhe avancat e klienteve."
        createHref="/financa/dokumente-arketimi/new"
        createLabel="Krijo Dokument Arketimi"
        createPermission={PERMISSIONS.salesInvoicesPay}
      />

      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                {['Dokumenti', 'Data', 'Klienti', 'Llogaria', 'Shuma', 'Aplikuar', 'Pa aplikuar', 'Statusi', 'Veprim'].map((title) => (
                  <th key={title} className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap first:pl-4 last:pr-4">{title}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {receipts.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-400">Nuk ka dokument arketimi te regjistruar.</td></tr>
              ) : receipts.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-3 py-2 first:pl-4 font-medium text-slate-900">{row.docNo}</td>
                  <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{date(row.docDate)}</td>
                  <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{row.customer?.name ?? '-'}</td>
                  <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{row.financeAccount?.code ?? row.financeAccount?.name ?? '-'}</td>
                  <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{money(row.enteredAmount)}</td>
                  <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{money(row.appliedAmount)}</td>
                  <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{money(row.unappliedAmount)}</td>
                  <td className="px-3 py-2"><StatusBadge value={row.status} /></td>
                  <td className="px-3 py-2 pr-4"><FinanceDocumentPostButton endpoint="customer-receipts" id={row.id} disabled={row.status !== 'DRAFT'} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
        Faza 1: dokumenti pa alokim postohet si unapplied receipt / advance. Alokimi direkt ne fatura shtohet ne fazen tjeter.
      </div>
    </div>
  );
}
