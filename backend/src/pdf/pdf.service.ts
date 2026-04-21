import { Injectable } from '@nestjs/common';

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit') as any;

@Injectable()
export class PdfService {
  private buildDoc(): any {
    return new PDFDocument({ margin: 50, size: 'A4' });
  }

  private collect(doc: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    });
  }

  private headerBlock(doc: any, title: string, docNo: string, docDate: string, status: string) {
    doc.fontSize(18).font('Helvetica-Bold').text('bp ERP System', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(13).font('Helvetica-Bold').text(title, { align: 'center' });
    doc.moveDown(0.2);
    doc.fontSize(10).font('Helvetica').text(
      `Nr. Doc: ${docNo}   |   Data: ${new Date(docDate).toLocaleDateString('sq-AL')}   |   Statusi: ${status}`,
      { align: 'center' },
    );
    doc.moveDown(0.8);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.6);
  }

  private partyRow(doc: any, leftLabel: string, leftEntity: Record<string, any>, rightLabel: string, rightValue: string) {
    const startY = doc.y;
    const col1 = 50;
    const col2 = 300;

    doc.font('Helvetica-Bold').fontSize(9).text(leftLabel, col1, startY);
    doc.font('Helvetica').fontSize(9);
    doc.text(leftEntity.name ?? '-', col1, doc.y);
    if (leftEntity.fiscalNo) doc.text(`Nr. Fiskal: ${leftEntity.fiscalNo}`, col1, doc.y);
    if (leftEntity.vatNo) doc.text(`Nr. TVSH: ${leftEntity.vatNo}`, col1, doc.y);
    if (leftEntity.address) doc.text(leftEntity.address, col1, doc.y);
    if (leftEntity.city) doc.text(leftEntity.city, col1, doc.y);

    const afterLeft = doc.y;

    doc.font('Helvetica-Bold').fontSize(9).text(rightLabel, col2, startY);
    doc.font('Helvetica').fontSize(9).text(rightValue, col2, startY + 14);

    doc.y = afterLeft;
    doc.moveDown(0.8);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.6);
  }

  private linesTableWithDiscount(doc: any, lines: any[]) {
    const cols = { no: 30, item: 140, qty: 45, price: 55, discPct: 42, discAmt: 50, net: 55, tax: 48, gross: 55 };
    const headers = ['#', 'Artikulli', 'Sasia', 'Çmimi', 'Zb%', 'Zbritja', 'Neto', 'TVSH', 'Bruto'];
    const widths = Object.values(cols);
    let x = 50;

    doc.font('Helvetica-Bold').fontSize(8);
    const hy = doc.y;
    headers.forEach((h, i) => {
      doc.text(h, x, hy, { width: widths[i], align: i < 2 ? 'left' : 'right' });
      x += widths[i];
    });
    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.3);

    doc.font('Helvetica').fontSize(8);
    for (const line of lines) {
      const ry = doc.y;
      x = 50;
      const cells = [
        String(line.lineNo),
        (line.item?.name ?? line.description ?? '').slice(0, 22),
        Number(line.qty).toFixed(3),
        Number(line.unitPrice).toFixed(2),
        Number(line.discountPercent ?? 0).toFixed(1),
        Number(line.discountAmount ?? 0).toFixed(2),
        Number(line.netAmount).toFixed(2),
        Number(line.taxAmount).toFixed(2),
        Number(line.grossAmount).toFixed(2),
      ];
      cells.forEach((c, i) => {
        doc.text(c, x, ry, { width: widths[i], align: i < 2 ? 'left' : 'right' });
        x += widths[i];
      });
      doc.moveDown(0.45);
    }
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.5);
  }

  private linesTableNoDiscount(doc: any, lines: any[]) {
    const cols = { no: 30, item: 215, qty: 55, price: 65, net: 65, tax: 55, gross: 65 };
    const headers = ['#', 'Artikulli', 'Sasia', 'Çmimi', 'Neto', 'TVSH', 'Bruto'];
    const widths = Object.values(cols);
    let x = 50;

    doc.font('Helvetica-Bold').fontSize(8);
    const hy = doc.y;
    headers.forEach((h, i) => {
      doc.text(h, x, hy, { width: widths[i], align: i < 2 ? 'left' : 'right' });
      x += widths[i];
    });
    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.3);

    doc.font('Helvetica').fontSize(8);
    for (const line of lines) {
      const ry = doc.y;
      x = 50;
      const cells = [
        String(line.lineNo),
        (line.item?.name ?? line.description ?? '').slice(0, 30),
        Number(line.qty).toFixed(3),
        Number(line.unitPrice).toFixed(2),
        Number(line.netAmount).toFixed(2),
        Number(line.taxAmount).toFixed(2),
        Number(line.grossAmount).toFixed(2),
      ];
      cells.forEach((c, i) => {
        doc.text(c, x, ry, { width: widths[i], align: i < 2 ? 'left' : 'right' });
        x += widths[i];
      });
      doc.moveDown(0.45);
    }
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.5);
  }

  private totalsBlock(doc: any, subtotal: number, taxTotal: number, grandTotal: number, discountTotal?: number) {
    const lx = 360;
    const vx = 455;
    const vw = 90;

    doc.font('Helvetica').fontSize(10);
    doc.text('Nëntotali:', lx, doc.y, { width: 90 });
    doc.text(subtotal.toFixed(2), vx, doc.y - 14, { width: vw, align: 'right' });
    doc.moveDown(0.4);

    if (discountTotal && discountTotal > 0) {
      doc.text('Zbritja:', lx, doc.y, { width: 90 });
      doc.text(discountTotal.toFixed(2), vx, doc.y - 14, { width: vw, align: 'right' });
      doc.moveDown(0.4);
    }

    doc.text('TVSH:', lx, doc.y, { width: 90 });
    doc.text(taxTotal.toFixed(2), vx, doc.y - 14, { width: vw, align: 'right' });
    doc.moveDown(0.4);

    doc.moveTo(lx, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.2);

    doc.font('Helvetica-Bold').fontSize(11);
    doc.text('Totali:', lx, doc.y, { width: 90 });
    doc.text(grandTotal.toFixed(2), vx, doc.y - 15, { width: vw, align: 'right' });
    doc.moveDown(1.5);
  }

  private footer(doc: any) {
    doc.font('Helvetica').fontSize(8).fillColor('#aaaaaa')
      .text('Gjeneruar nga bp ERP System', 50, doc.y, { align: 'center' });
    doc.fillColor('#000000');
  }

  async generatePurchaseInvoicePdf(invoice: any): Promise<Buffer> {
    const doc = this.buildDoc();

    this.headerBlock(doc, 'FATURË BLERJEJE', invoice.docNo, invoice.docDate, invoice.status);

    if (invoice.supplierInvoiceNo) {
      doc.font('Helvetica').fontSize(9).text(`Nr. Faturës së Furnitorit: ${invoice.supplierInvoiceNo}`);
      doc.moveDown(0.4);
    }

    this.partyRow(doc, 'Furnitori', invoice.supplier ?? {}, 'Magazina', invoice.warehouse?.name ?? '-');
    this.linesTableWithDiscount(doc, invoice.lines ?? []);
    this.totalsBlock(doc, Number(invoice.subtotal), Number(invoice.taxTotal), Number(invoice.grandTotal), Number(invoice.discountTotal));
    this.footer(doc);

    return this.collect(doc);
  }

  async generateSalesInvoicePdf(invoice: any): Promise<Buffer> {
    const doc = this.buildDoc();

    this.headerBlock(doc, 'FATURË SHITJEJE', invoice.docNo, invoice.docDate, invoice.status);

    if (invoice.paymentMethod) {
      doc.font('Helvetica').fontSize(9).text(`Metoda e Pagesës: ${invoice.paymentMethod.name}`);
      doc.moveDown(0.4);
    }

    this.partyRow(doc, 'Klienti', invoice.customer ?? {}, 'Magazina', invoice.warehouse?.name ?? '-');
    this.linesTableWithDiscount(doc, invoice.lines ?? []);
    this.totalsBlock(doc, Number(invoice.subtotal), Number(invoice.taxTotal), Number(invoice.grandTotal), Number(invoice.discountTotal));

    if (invoice.fiscalReference) {
      doc.font('Helvetica').fontSize(9).text(`Referenca Fiskale: ${invoice.fiscalReference}`);
      doc.moveDown(0.5);
    }

    this.footer(doc);
    return this.collect(doc);
  }

  async generateSalesReturnPdf(ret: any): Promise<Buffer> {
    const doc = this.buildDoc();

    this.headerBlock(doc, 'KTHIM SHITJEJE', ret.docNo, ret.docDate, ret.status);

    doc.font('Helvetica').fontSize(9).text(`Fatura Origjinale: ${ret.salesInvoice?.docNo ?? '-'}`);
    if (ret.reason) doc.text(`Arsyeja: ${ret.reason}`);
    doc.moveDown(0.6);

    this.partyRow(doc, 'Klienti', ret.customer ?? {}, 'Fatura Origjinale', ret.salesInvoice?.docNo ?? '-');
    this.linesTableNoDiscount(doc, ret.lines ?? []);
    this.totalsBlock(doc, Number(ret.subtotal), Number(ret.taxTotal), Number(ret.grandTotal));
    this.footer(doc);

    return this.collect(doc);
  }
}
