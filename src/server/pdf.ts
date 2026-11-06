import "server-only";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { formatBp, formatPaise } from "@/lib/money";
import { formatIstDateTime } from "@/lib/time";
import { rupeesInWords } from "@/lib/words";
import type { PrintableDoc } from "./documents";

export type Layout = "a4" | "thermal";

const INK = rgb(0.11, 0.1, 0.09);
const MUTED = rgb(0.42, 0.4, 0.35);
const LINE = rgb(0.8, 0.78, 0.72);

/** Standard PDF fonts only cover Latin-1, so the rupee sign becomes "Rs." and anything else unprintable is dropped. */
export function pdfSafe(text: string): string {
  return text.replace(/₹/g, "Rs.").replace(/[^\x20-\x7E -ÿ]/g, "");
}

const money = (paise: number) => formatPaise(paise, { symbol: "" });

type Col = { label: string; width: number; align: "left" | "right" };

/** A tiny top-down text cursor over pdf-lib's bottom-up coordinates. */
class Cursor {
  y: number;
  constructor(
    readonly page: PDFPage,
    readonly fonts: { regular: PDFFont; bold: PDFFont },
    readonly left: number,
    readonly right: number,
  ) {
    this.y = page.getHeight() - 28;
  }
  get width() {
    return this.right - this.left;
  }
  fit(text: string, size: number, bold: boolean, maxWidth: number): string {
    const font = bold ? this.fonts.bold : this.fonts.regular;
    let t = pdfSafe(text);
    while (t.length > 1 && font.widthOfTextAtSize(t, size) > maxWidth) t = t.slice(0, -2) + ".";
    return t;
  }
  text(text: string, opts: { size?: number; bold?: boolean; x?: number; align?: "left" | "right" | "center"; color?: typeof INK; width?: number } = {}) {
    const size = opts.size ?? 9;
    const font = opts.bold ? this.fonts.bold : this.fonts.regular;
    const box = opts.width ?? this.width;
    const x0 = opts.x ?? this.left;
    const t = this.fit(text, size, Boolean(opts.bold), box);
    const w = font.widthOfTextAtSize(t, size);
    const x = opts.align === "right" ? x0 + box - w : opts.align === "center" ? x0 + (box - w) / 2 : x0;
    this.page.drawText(t, { x, y: this.y - size, size, font, color: opts.color ?? INK });
  }
  /** Word-wraps a paragraph across lines. */
  para(text: string, size = 8, color = MUTED) {
    const words = pdfSafe(text).split(/\s+/);
    let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (this.fonts.regular.widthOfTextAtSize(next, size) > this.width && line) {
        this.text(line, { size, color });
        this.down(size + 2);
        line = w;
      } else line = next;
    }
    if (line) {
      this.text(line, { size, color });
      this.down(size + 2);
    }
  }
  down(n: number) {
    this.y -= n;
  }
  rule(dashed = false) {
    this.page.drawLine({
      start: { x: this.left, y: this.y },
      end: { x: this.right, y: this.y },
      thickness: 0.6,
      color: LINE,
      dashArray: dashed ? [2, 2] : undefined,
    });
    this.down(6);
  }
  row(cols: Col[], values: string[], opts: { size?: number; bold?: boolean; color?: typeof INK } = {}) {
    let x = this.left;
    cols.forEach((c, i) => {
      this.text(values[i] ?? "", { x, width: c.width - 4, align: c.align, size: opts.size, bold: opts.bold, color: opts.color });
      x += c.width;
    });
    this.down((opts.size ?? 9) + 4);
  }
  /** Columns sized as fractions of the usable width. */
  cols(spec: [string, number, "left" | "right"][]): Col[] {
    return spec.map(([label, frac, align]) => ({ label, width: frac * this.width, align }));
  }
}

async function drawQr(page: PDFPage, pdf: PDFDocument, text: string, x: number, y: number, size: number) {
  const png = await QRCode.toBuffer(text, { margin: 1, width: 300, errorCorrectionLevel: "M" });
  const img = await pdf.embedPng(png);
  page.drawImage(img, { x, y, width: size, height: size });
}

function header(c: Cursor, doc: PrintableDoc, compact: boolean) {
  const center = compact ? "center" : "left";
  c.text(doc.supplier.name, { size: compact ? 12 : 16, bold: true, align: center });
  c.down(compact ? 15 : 20);
  c.para(doc.supplier.address, compact ? 7 : 8);
  if (doc.supplier.gstin) {
    c.text(`GSTIN ${doc.supplier.gstin}`, { size: compact ? 7.5 : 8.5, bold: true, align: center });
    c.down(11);
  }
  c.down(4);
  c.text(doc.title, { size: compact ? 10 : 12, bold: true, align: center });
  c.down(compact ? 14 : 18);
}

function meta(c: Cursor, doc: PrintableDoc, compact: boolean) {
  const size = compact ? 7.5 : 8.5;
  const pairs: [string, string][] = [
    ["No.", doc.number],
    ["Date", formatIstDateTime(doc.issuedAt)],
    ["Token", doc.token],
    ["Paid by", doc.paymentMode],
  ];
  if (doc.registered) pairs.push(["Place of supply", doc.placeOfSupply]);
  if (doc.reference) pairs.push(["Reference", doc.reference]);
  if (doc.reason) pairs.push(["Reason", doc.reason]);
  if (doc.buyer.name) pairs.push(["Bill to", doc.buyer.name]);
  if (doc.buyer.gstin) pairs.push(["Buyer GSTIN", doc.buyer.gstin]);
  for (const [k, v] of pairs) {
    c.text(k, { size, color: MUTED, width: compact ? c.width * 0.38 : 110 });
    c.text(v, { size, x: c.left + (compact ? c.width * 0.38 : 110), width: c.width - (compact ? c.width * 0.38 : 110) });
    c.down(size + 4);
  }
  c.down(4);
}

function linesTable(c: Cursor, doc: PrintableDoc, compact: boolean) {
  const size = compact ? 7.5 : 8.5;
  const cols = compact
    ? c.cols([["Item", 0.5, "left"], ["Qty", 0.12, "right"], ["Rate", 0.18, "right"], ["Amount", 0.2, "right"]])
    : doc.registered
      ? c.cols([["Item", 0.32, "left"], ["HSN/SAC", 0.11, "left"], ["Qty", 0.07, "right"], ["Rate", 0.11, "right"], ["Taxable", 0.13, "right"], ["GST", 0.08, "right"], ["Tax", 0.08, "right"], ["Amount", 0.1, "right"]])
      : c.cols([["Item", 0.5, "left"], ["Qty", 0.12, "right"], ["Rate", 0.18, "right"], ["Amount", 0.2, "right"]]);
  c.rule();
  c.row(cols, cols.map((x) => x.label), { size, bold: true });
  c.rule();
  for (const l of doc.lines) {
    const values = cols.length === 8
      ? [l.name, l.hsnSac, String(l.quantity), money(l.unitPricePaise), money(l.taxablePaise), formatBp(l.gstRateBp), money(l.taxPaise), money(l.totalPaise)]
      : [l.name, String(l.quantity), money(l.unitPricePaise), money(l.totalPaise)];
    c.row(cols, values, { size });
    if (compact && doc.registered) {
      c.text(`HSN ${l.hsnSac} - GST ${formatBp(l.gstRateBp)}`, { size: 6.5, color: MUTED });
      c.down(9);
    }
  }
  c.rule();
}

function gstTable(c: Cursor, doc: PrintableDoc, compact: boolean) {
  if (!doc.registered || doc.byRate.length === 0) return;
  const size = compact ? 7 : 8;
  c.text("GST breakdown", { size, bold: true });
  c.down(size + 5);
  const cols = doc.isInterState
    ? c.cols([["Rate", 0.25, "left"], ["Taxable", 0.4, "right"], ["IGST", 0.35, "right"]])
    : c.cols([["Rate", 0.16, "left"], ["Taxable", 0.3, "right"], ["CGST", 0.27, "right"], ["SGST", 0.27, "right"]]);
  c.row(cols, cols.map((x) => x.label), { size, color: MUTED });
  for (const r of doc.byRate) {
    const values = doc.isInterState
      ? [formatBp(r.gstRateBp), money(r.taxablePaise), money(r.igstPaise)]
      : [formatBp(r.gstRateBp), money(r.taxablePaise), money(r.cgstPaise), money(r.sgstPaise)];
    c.row(cols, values, { size });
  }
  c.rule(true);
}

function totals(c: Cursor, doc: PrintableDoc, compact: boolean) {
  const size = compact ? 8 : 9;
  const rows: [string, number][] = [];
  if (doc.registered) {
    rows.push(["Taxable value", doc.taxablePaise]);
    if (doc.isInterState) rows.push(["IGST", doc.igstPaise]);
    else rows.push(["CGST", doc.cgstPaise], ["SGST", doc.sgstPaise]);
  }
  rows.push(["Round off", doc.roundOffPaise]);
  const labelW = c.width * 0.6;
  for (const [k, v] of rows) {
    c.text(k, { size, color: MUTED, width: labelW });
    c.text(money(v), { size, x: c.left + labelW, width: c.width - labelW, align: "right" });
    c.down(size + 4);
  }
  c.down(2);
  c.text(doc.title === "CREDIT NOTE" ? "Total credited" : "Total", { size: size + 3, bold: true, width: labelW });
  c.text(`Rs. ${money(doc.totalPaise)}`, { size: size + 3, bold: true, x: c.left + labelW, width: c.width - labelW, align: "right" });
  c.down(size + 8);
  c.para(rupeesInWords(doc.totalPaise), compact ? 7 : 8);
  if (!doc.registered) c.para("Supplier not registered under GST. No tax has been charged.", compact ? 6.5 : 7.5);
}

/** Renders an invoice, bill of supply or credit note as an A4 page or an 80 mm thermal roll. */
export async function renderDocPdf(doc: PrintableDoc, layout: Layout): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${doc.title} ${doc.number}`);
  pdf.setCreator(doc.supplier.name);
  const fonts = { regular: await pdf.embedFont(StandardFonts.Helvetica), bold: await pdf.embedFont(StandardFonts.HelveticaBold) };
  const compact = layout === "thermal";

  // 80 mm paper is ~227 pt wide with ~72 mm printable; draw on a tall strip and crop it afterwards.
  const width = compact ? 227 : 595.28;
  const height = compact ? 3000 : 841.89;
  const page = pdf.addPage([width, height]);
  const margin = compact ? 12 : 48;
  const c = new Cursor(page, fonts, margin, width - margin);
  if (!compact) c.down(12);

  if (doc.logo && !compact) {
    const img = doc.logo.mime === "image/png" ? await pdf.embedPng(doc.logo.data) : doc.logo.mime === "image/jpeg" ? await pdf.embedJpg(doc.logo.data) : null;
    if (img) {
      const s = img.scaleToFit(64, 64);
      page.drawImage(img, { x: width - margin - s.width, y: c.y - s.height, width: s.width, height: s.height });
    }
  }

  header(c, doc, compact);
  meta(c, doc, compact);
  linesTable(c, doc, compact);
  gstTable(c, doc, compact);
  totals(c, doc, compact);

  if (doc.upiLink) {
    const qr = compact ? 96 : 88;
    c.down(6);
    const x = compact ? (width - qr) / 2 : c.left;
    await drawQr(page, pdf, doc.upiLink, x, c.y - qr, qr);
    c.down(qr + 4);
    c.text("Scan with any UPI app", { size: 7, color: MUTED, align: compact ? "center" : "left" });
    c.down(12);
  }
  c.down(4);
  c.text("Computer-generated document. Prices and GST as per the canteen's menu.", { size: 6.5, color: MUTED, align: compact ? "center" : "left" });
  c.down(16);

  if (compact) page.setMediaBox(0, c.y, width, height - c.y);
  return pdf.save();
}
