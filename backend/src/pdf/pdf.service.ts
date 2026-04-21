import { Injectable } from '@nestjs/common';

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit') as any;

// ─── Design tokens ──────────────────────────────────────────────────────────
const NAVY    = '#0f172a';
const INDIGO  = '#4f46e5';
const SLATE50 = '#f8fafc';
const SLATE100= '#f1f5f9';
const SLATE200= '#e2e8f0';
const SLATE500= '#64748b';
const WHITE   = '#ffffff';
const BLACK   = '#1e293b';

const PAGE_W  = 595;
const PAGE_H  = 842;
const MARGIN  = 40;
const CW      = PAGE_W - 2 * MARGIN; // 515

@Injectable()
export class PdfService {

  private buildDoc(): any {
    return new PDFDocument({ margin: 0, size: 'A4' });
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

  // ── Header band ────────────────────────────────────────────────────────────
  private drawHeader(doc: any, docType: string, docNo: string, docDate: string, status: string): number {
    const H = 78;

    // Background
    doc.rect(0, 0, PAGE_W, H).fill(NAVY);
    // Accent stripe
    doc.rect(0, H, PAGE_W, 3).fill(INDIGO);

    // Left: company + doc type
    doc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica')
       .text('bp ERP System', MARGIN, 13);
    doc.fillColor(WHITE).fontSize(17).font('Helvetica-Bold')
       .text(docType, MARGIN, 26);

    // Right: doc number (large) + date/status
    const rw = CW;
    doc.fillColor('#94a3b8').fontSize(7).font('Helvetica')
       .text('Nr. Dokumentit', MARGIN, 13, { width: rw, align: 'right' });
    doc.fillColor(WHITE).fontSize(14).font('Helvetica-Bold')
       .text(docNo, MARGIN, 26, { width: rw, align: 'right' });
    doc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica')
       .text(
         `${new Date(docDate).toLocaleDateString('sq-AL')}  ·  ${status}`,
         MARGIN, 48, { width: rw, align: 'right' },
       );

    return H + 3 + 14; // after stripe + small gap
  }

  // ── Two-column party block ──────────────────────────────────────────────────
  private drawParty(
    doc: any,
    startY: number,
    left: { label: string; entity: Record<string, any> },
    right: { label: string; lines: string[] },
  ): number {
    const H = 68;
    const GAP = 8;
    const COL = (CW - GAP) / 2;

    // Left box
    const lx = MARGIN;
    doc.rect(lx, startY, COL, H).fill(SLATE100);
    doc.rect(lx, startY, 3, H).fill(INDIGO);

    let ly = startY + 9;
    doc.fillColor(INDIGO).fontSize(6.5).font('Helvetica-Bold')
       .text(left.label.toUpperCase(), lx + 10, ly);
    ly += 11;
    doc.fillColor(BLACK).fontSize(9).font('Helvetica-Bold')
       .text((left.entity.name ?? '-').slice(0, 36), lx + 10, ly);
    ly += 12;
    doc.font('Helvetica').fontSize(7.5).fillColor(SLATE500);
    for (const field of [
      left.entity.fiscalNo ? `Nr. Fiskal: ${left.entity.fiscalNo}` : null,
      left.entity.vatNo    ? `Nr. TVSH: ${left.entity.vatNo}`      : null,
      left.entity.address  ? left.entity.address                   : null,
      left.entity.city     ? left.entity.city                      : null,
    ]) {
      if (field && ly < startY + H - 5) {
        doc.text(field.slice(0, 40), lx + 10, ly);
        ly += 10;
      }
    }

    // Right box
    const rx = MARGIN + COL + GAP;
    doc.rect(rx, startY, COL, H).fill(SLATE50);
    doc.rect(rx, startY, 3, H).fill(SLATE200);

    doc.fillColor(SLATE500).fontSize(6.5).font('Helvetica-Bold')
       .text(right.label.toUpperCase(), rx + 10, startY + 9);
    let ry = startY + 20;
    for (const line of right.lines.slice(0, 5)) {
      if (line) {
        doc.fillColor(BLACK).fontSize(8).font('Helvetica')
           .text(line.slice(0, 40), rx + 10, ry);
        ry += 11;
      }
    }

    doc.rect(MARGIN, startY + H + 1, CW, 1).fill(SLATE200);
    return startY + H + 12;
  }

  // ── Table header ────────────────────────────────────────────────────────────
  private drawTableHeader(
    doc: any,
    y: number,
    cols: Array<{ label: string; w: number; align?: string }>,
  ): number {
    const ROW_H = 20;
    doc.rect(MARGIN, y, CW, ROW_H).fill(NAVY);

    let x = MARGIN;
    doc.fillColor(WHITE).fontSize(7).font('Helvetica-Bold');
    for (const col of cols) {
      doc.text(col.label, x + 3, y + 6.5, {
        width: col.w - 6,
        align: col.align ?? 'right',
      });
      x += col.w;
    }
    return y + ROW_H;
  }

  // ── Table row ───────────────────────────────────────────────────────────────
  private drawTableRow(
    doc: any,
    y: number,
    idx: number,
    cells: Array<{ value: string; w: number; align?: string; bold?: boolean }>,
    pageH = PAGE_H,
  ): number {
    const ROW_H = 17;

    // Check page overflow
    if (y + ROW_H > pageH - 60) {
      doc.addPage({ margin: 0, size: 'A4' });
      return 40; // reset y on new page
    }

    if (idx % 2 === 0) {
      doc.rect(MARGIN, y, CW, ROW_H).fill(SLATE50);
    }
    // Bottom rule
    doc.rect(MARGIN, y + ROW_H - 0.5, CW, 0.5).fill(SLATE200);

    let x = MARGIN;
    for (const cell of cells) {
      doc.fillColor(BLACK)
         .fontSize(7.5)
         .font(cell.bold ? 'Helvetica-Bold' : 'Helvetica')
         .text(cell.value, x + 3, y + 4.5, {
           width: cell.w - 6,
           align: cell.align ?? 'right',
         });
      x += cell.w;
    }
    return y + ROW_H;
  }

  // ── Totals block ─────────────────────────────────────────────────────────────
  private drawTotals(
    doc: any,
    y: number,
    items: Array<{ label: string; value: string; highlight?: boolean }>,
  ): number {
    const BOX_W = 195;
    const bx = MARGIN + CW - BOX_W;
    const ROW_H = 19;
    const totalH = items.length * ROW_H;

    doc.rect(bx, y, BOX_W, totalH).fill(SLATE100);
    doc.rect(bx, y, BOX_W, totalH).stroke(SLATE200);

    let ty = y;
    for (const item of items) {
      if (item.highlight) {
        doc.rect(bx, ty, BOX_W, ROW_H).fill(NAVY);
        doc.fillColor(WHITE).fontSize(9.5).font('Helvetica-Bold')
           .text(item.label, bx + 10, ty + 5, { width: 95 });
        doc.text(item.value, bx + 95, ty + 5, {
          width: BOX_W - 105, align: 'right',
        });
      } else {
        doc.rect(bx, ty + ROW_H - 0.5, BOX_W, 0.5).fill(SLATE200);
        doc.fillColor(SLATE500).fontSize(7.5).font('Helvetica')
           .text(item.label, bx + 10, ty + 5.5, { width: 95 });
        doc.fillColor(BLACK).text(item.value, bx + 95, ty + 5.5, {
          width: BOX_W - 105, align: 'right',
        });
      }
      ty += ROW_H;
    }
    return ty + 16;
  }

  // ── Footer ──────────────────────────────────────────────────────────────────
  private drawFooter(doc: any): void {
    const fy = PAGE_H - 30;
    doc.rect(MARGIN, fy, CW, 0.5).fill(SLATE200);
    doc.fillColor(SLATE500).fontSize(7).font('Helvetica')
       .text('Gjeneruar nga bp ERP System', MARGIN, fy + 8);
    doc.text(
      new Date().toLocaleString('sq-AL'),
      MARGIN, fy + 8, { width: CW, align: 'right' },
    );
  }

  // ── Helper: build totals rows ────────────────────────────────────────────────
  private buildTotals(
    subtotal: number,
    taxTotal: number,
    grandTotal: number,
    discountTotal?: number,
  ) {
    const rows: Array<{ label: string; value: string; highlight?: boolean }> = [];
    rows.push({ label: 'Nëntotali', value: subtotal.toFixed(2) });
    if ((discountTotal ?? 0) > 0) {
      rows.push({ label: 'Zbritja', value: `– ${(discountTotal ?? 0).toFixed(2)}` });
    }
    rows.push({ label: 'TVSH', value: taxTotal.toFixed(2) });
    rows.push({ label: 'TOTALI', value: grandTotal.toFixed(2), highlight: true });
    return rows;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PURCHASE INVOICE
  // ═══════════════════════════════════════════════════════════════════════════
  async generatePurchaseInvoicePdf(invoice: any): Promise<Buffer> {
    const doc = this.buildDoc();

    let y = this.drawHeader(doc, 'FATURË BLERJEJE', invoice.docNo, invoice.docDate, invoice.status);

    if (invoice.supplierInvoiceNo) {
      doc.fillColor(SLATE500).fontSize(7.5).font('Helvetica')
         .text(`Nr. Faturës Furnitorit: ${invoice.supplierInvoiceNo}`, MARGIN, y);
      y += 13;
    }

    y = this.drawParty(doc, y,
      { label: 'Furnitori', entity: invoice.supplier ?? {} },
      { label: 'Magazina', lines: [invoice.warehouse?.name ?? '-'] },
    );

    // Columns (total must = CW = 515)
    const cols = [
      { label: '#',        w: 22,  align: 'left' },
      { label: 'Artikulli',w: 165, align: 'left' },
      { label: 'Sasia',    w: 45  },
      { label: 'Çmimi',    w: 58  },
      { label: 'Zb%',      w: 30  },
      { label: 'Zbritja',  w: 52  },
      { label: 'Neto',     w: 52  },
      { label: 'TVSH',     w: 45  },
      { label: 'Bruto',    w: 46  },
    ]; // 22+165+45+58+30+52+52+45+46 = 515 ✓

    y = this.drawTableHeader(doc, y, cols);

    for (let i = 0; i < (invoice.lines ?? []).length; i++) {
      const l = invoice.lines[i];
      y = this.drawTableRow(doc, y, i, [
        { value: String(l.lineNo),                               w: 22,  align: 'left' },
        { value: (l.item?.name ?? '').slice(0, 30),              w: 165, align: 'left' },
        { value: Number(l.qty).toFixed(2),                       w: 45  },
        { value: Number(l.unitPrice).toFixed(2),                 w: 58  },
        { value: Number(l.discountPercent ?? 0).toFixed(1),      w: 30  },
        { value: Number(l.discountAmount ?? 0).toFixed(2),       w: 52  },
        { value: Number(l.netAmount).toFixed(2),                 w: 52  },
        { value: Number(l.taxAmount).toFixed(2),                 w: 45  },
        { value: Number(l.grossAmount).toFixed(2),               w: 46, bold: true },
      ]);
    }

    y += 12;
    y = this.drawTotals(doc, y, this.buildTotals(
      Number(invoice.subtotal), Number(invoice.taxTotal),
      Number(invoice.grandTotal), Number(invoice.discountTotal),
    ));

    if (invoice.notes) {
      doc.fillColor(SLATE500).fontSize(7.5).font('Helvetica')
         .text(`Shënime: ${invoice.notes}`, MARGIN, y, { width: CW - 220 });
    }

    this.drawFooter(doc);
    return this.collect(doc);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SALES INVOICE
  // ═══════════════════════════════════════════════════════════════════════════
  async generateSalesInvoicePdf(invoice: any): Promise<Buffer> {
    const doc = this.buildDoc();

    let y = this.drawHeader(doc, 'FATURË SHITJEJE', invoice.docNo, invoice.docDate, invoice.status);

    y = this.drawParty(doc, y,
      { label: 'Klienti', entity: invoice.customer ?? {} },
      {
        label: 'Detajet',
        lines: [
          invoice.warehouse?.name ? `Magazina: ${invoice.warehouse.name}` : '',
          invoice.paymentMethod?.name ? `Pagesa: ${invoice.paymentMethod.name}` : '',
          invoice.fiscalReference ? `Ref. Fiskale: ${invoice.fiscalReference}` : '',
        ].filter(Boolean),
      },
    );

    const cols = [
      { label: '#',         w: 22,  align: 'left' },
      { label: 'Artikulli', w: 165, align: 'left' },
      { label: 'Sasia',     w: 45  },
      { label: 'Çmimi',     w: 58  },
      { label: 'Zb%',       w: 30  },
      { label: 'Zbritja',   w: 52  },
      { label: 'Neto',      w: 52  },
      { label: 'TVSH',      w: 45  },
      { label: 'Bruto',     w: 46  },
    ];

    y = this.drawTableHeader(doc, y, cols);

    for (let i = 0; i < (invoice.lines ?? []).length; i++) {
      const l = invoice.lines[i];
      y = this.drawTableRow(doc, y, i, [
        { value: String(l.lineNo),                               w: 22,  align: 'left' },
        { value: (l.item?.name ?? '').slice(0, 30),              w: 165, align: 'left' },
        { value: Number(l.qty).toFixed(2),                       w: 45  },
        { value: Number(l.unitPrice).toFixed(2),                 w: 58  },
        { value: Number(l.discountPercent ?? 0).toFixed(1),      w: 30  },
        { value: Number(l.discountAmount ?? 0).toFixed(2),       w: 52  },
        { value: Number(l.netAmount).toFixed(2),                 w: 52  },
        { value: Number(l.taxAmount).toFixed(2),                 w: 45  },
        { value: Number(l.grossAmount).toFixed(2),               w: 46, bold: true },
      ]);
    }

    y += 12;
    y = this.drawTotals(doc, y, this.buildTotals(
      Number(invoice.subtotal), Number(invoice.taxTotal),
      Number(invoice.grandTotal), Number(invoice.discountTotal),
    ));

    if (invoice.notes) {
      doc.fillColor(SLATE500).fontSize(7.5).font('Helvetica')
         .text(`Shënime: ${invoice.notes}`, MARGIN, y, { width: CW - 220 });
    }

    this.drawFooter(doc);
    return this.collect(doc);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SALES RETURN
  // ═══════════════════════════════════════════════════════════════════════════
  async generateSalesReturnPdf(ret: any): Promise<Buffer> {
    const doc = this.buildDoc();

    let y = this.drawHeader(doc, 'KTHIM SHITJEJE', ret.docNo, ret.docDate, ret.status);

    y = this.drawParty(doc, y,
      { label: 'Klienti', entity: ret.customer ?? {} },
      {
        label: 'Fatura Origjinale',
        lines: [
          ret.salesInvoice?.docNo ?? '-',
          ret.reason ? `Arsyeja: ${ret.reason}` : '',
        ].filter(Boolean),
      },
    );

    // Columns for return (no discount) — total = 515
    const cols = [
      { label: '#',         w: 22,  align: 'left' },
      { label: 'Artikulli', w: 205, align: 'left' },
      { label: 'Sasia',     w: 55  },
      { label: 'Çmimi',     w: 65  },
      { label: 'Neto',      w: 65  },
      { label: 'TVSH',      w: 55  },
      { label: 'Bruto',     w: 48  },
    ]; // 22+205+55+65+65+55+48 = 515 ✓

    y = this.drawTableHeader(doc, y, cols);

    for (let i = 0; i < (ret.lines ?? []).length; i++) {
      const l = ret.lines[i];
      y = this.drawTableRow(doc, y, i, [
        { value: String(l.lineNo),              w: 22,  align: 'left' },
        { value: (l.item?.name ?? '').slice(0, 34), w: 205, align: 'left' },
        { value: Number(l.qty).toFixed(2),      w: 55  },
        { value: Number(l.unitPrice).toFixed(2),w: 65  },
        { value: Number(l.netAmount).toFixed(2),w: 65  },
        { value: Number(l.taxAmount).toFixed(2),w: 55  },
        { value: Number(l.grossAmount).toFixed(2), w: 48, bold: true },
      ]);
    }

    y += 12;
    y = this.drawTotals(doc, y, this.buildTotals(
      Number(ret.subtotal), Number(ret.taxTotal), Number(ret.grandTotal),
    ));

    if (ret.notes) {
      doc.fillColor(SLATE500).fontSize(7.5).font('Helvetica')
         .text(`Shënime: ${ret.notes}`, MARGIN, y, { width: CW - 220 });
    }

    this.drawFooter(doc);
    return this.collect(doc);
  }
}
