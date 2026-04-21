import { PageHeader } from '@/components/page-header';
import { SalesInvoiceForm } from '@/components/invoices/sales-invoice-form';
import { PdfButtons } from '@/components/invoices/pdf-download-button';
import { DocumentActionPanel } from '@/components/invoices/document-action-panel';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { requirePagePermission } from '@/lib/server-page-auth';

export default async function EditSalesInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission(PERMISSIONS.salesInvoicesManage);
  const resolved = await params;
  const [doc, series, customers, warehouses, paymentMethods, items] = await Promise.all([
    api.get('sales-invoices', resolved.id),
    api.list('document-series'),
    api.list('customers'),
    api.list('warehouses'),
    api.list('payment-methods'),
    api.list('items'),
  ]);

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <PageHeader
          title={`Fature Shitjeje ${doc.docNo}`}
          description={`Statusi: ${doc.status} · Krijuar: ${new Date(doc.createdAt).toLocaleDateString('sq-AL')}`}
        />
        <PdfButtons baseHref={`/api/proxy/pdf/sales-invoices/${resolved.id}`} docNo={doc.docNo} />
      </div>

      <div className="mb-4">
        <DocumentActionPanel
          documentType="sales-invoices"
          documentId={resolved.id}
          docNo={doc.docNo}
          status={doc.status}
          grandTotal={doc.grandTotal}
          amountPaid={doc.amountPaid}
          outstandingAmount={doc.outstandingAmount}
          settlementTotal={doc.settlementTotal}
          creditedAmount={doc.creditedAmount}
          settlementStatus={doc.settlementStatus}
          paymentStatus={doc.paymentStatus}
          dueDate={doc.dueDate}
          dueState={doc.dueState}
          daysPastDue={doc.daysPastDue}
          payments={doc.payments}
          fiscalStatus={doc.fiscalStatus}
          fiscalReference={doc.fiscalReference}
          fiscalError={doc.fiscalError}
        />
      </div>

      <SalesInvoiceForm
        mode="edit"
        data={doc}
        series={series.filter((x: any) => x.documentType === 'SALES_INVOICE')}
        customers={customers}
        warehouses={warehouses}
        paymentMethods={paymentMethods}
        items={items}
      />
    </div>
  );
}
