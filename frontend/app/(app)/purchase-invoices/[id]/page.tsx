import { PageHeader } from '@/components/page-header';
import { PurchaseInvoiceForm } from '@/components/invoices/purchase-invoice-form';
import { PdfButtons } from '@/components/invoices/pdf-download-button';
import { DocumentActionPanel } from '@/components/invoices/document-action-panel';
import { api } from '@/lib/api';

export default async function EditPurchaseInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolved = await params;
  const [doc, series, suppliers, warehouses, items] = await Promise.all([
    api.get('purchase-invoices', resolved.id),
    api.list('document-series'),
    api.list('suppliers'),
    api.list('warehouses'),
    api.list('items'),
  ]);

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <PageHeader
          title={`Fature Blerjeje ${doc.docNo}`}
          description={`Statusi: ${doc.status} · Krijuar: ${new Date(doc.createdAt).toLocaleDateString('sq-AL')}`}
        />
        <PdfButtons baseHref={`/api/proxy/pdf/purchase-invoices/${resolved.id}`} docNo={doc.docNo} />
      </div>

      <div className="mb-4">
        <DocumentActionPanel
          documentType="purchase-invoices"
          documentId={resolved.id}
          docNo={doc.docNo}
          status={doc.status}
          grandTotal={doc.grandTotal}
          amountPaid={doc.amountPaid}
          paymentStatus={doc.paymentStatus}
          dueDate={doc.dueDate}
        />
      </div>

      <PurchaseInvoiceForm
        mode="edit"
        data={doc}
        series={series.filter((x: any) => x.documentType === 'PURCHASE_INVOICE')}
        suppliers={suppliers}
        warehouses={warehouses}
        items={items}
      />
    </div>
  );
}
