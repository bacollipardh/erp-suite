import { PageHeader } from '@/components/page-header';
import { SalesReturnForm } from '@/components/invoices/sales-return-form';
import { PdfButtons } from '@/components/invoices/pdf-download-button';
import { DocumentActionPanel } from '@/components/invoices/document-action-panel';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function EditSalesReturnPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission(PERMISSIONS.salesReturnsManage);
  const resolved = await params;
  const [doc, series, customers, salesInvoices, items] = await Promise.all([
    api.get('sales-returns', resolved.id),
    api.list('document-series'),
    api.list('customers'),
    api.list('sales-invoices'),
    api.list('items'),
  ]);

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <PageHeader
          title={`Kthim Shitjeje ${doc.docNo}`}
          description={`Statusi: ${doc.status} · Krijuar: ${new Date(doc.createdAt).toLocaleDateString('sq-AL')}`}
        />
        <PdfButtons baseHref={`/api/proxy/pdf/sales-returns/${resolved.id}`} docNo={doc.docNo} />
      </div>

      <div className="mb-4">
        <DocumentActionPanel
          documentType="sales-returns"
          documentId={resolved.id}
          docNo={doc.docNo}
          status={doc.status}
          grandTotal={doc.grandTotal}
          fiscalStatus={doc.fiscalStatus}
          fiscalReference={doc.fiscalReference}
          fiscalError={doc.fiscalError}
        />
      </div>

      <SalesReturnForm
        mode="edit"
        data={doc}
        series={series.filter((x: any) => x.documentType === 'SALES_RETURN')}
        customers={customers}
        salesInvoices={salesInvoices}
        items={items}
      />
    </div>
  );
}
