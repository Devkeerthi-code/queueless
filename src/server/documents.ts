import "server-only";
import { GST_STATES } from "@/lib/gstin";
import { upiPayLink } from "@/lib/upi";
import { prisma } from "./db";

export type DocLine = {
  name: string;
  hsnSac: string;
  quantity: number;
  unitPricePaise: number;
  gstRateBp: number;
  taxablePaise: number;
  taxPaise: number;
  totalPaise: number;
};

export type DocRate = { gstRateBp: number; taxablePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number };

/** Everything a printed invoice or credit note shows, independent of layout. */
export type PrintableDoc = {
  title: "TAX INVOICE" | "BILL OF SUPPLY" | "CREDIT NOTE";
  number: string;
  issuedAt: Date;
  reference?: string;
  reason?: string;
  token: string;
  paymentMode: string;
  supplier: { name: string; address: string; gstin: string | null; state: string };
  buyer: { name: string | null; gstin: string | null };
  placeOfSupply: string;
  isInterState: boolean;
  registered: boolean;
  lines: DocLine[];
  byRate: DocRate[];
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  roundOffPaise: number;
  totalPaise: number;
  upiLink: string | null;
  logo: { mime: string; data: Uint8Array } | null;
};

function groupByRate(lines: (DocRate & { gstRateBp: number })[]): DocRate[] {
  const map = new Map<number, DocRate>();
  for (const l of lines) {
    const r = map.get(l.gstRateBp) ?? { gstRateBp: l.gstRateBp, taxablePaise: 0, cgstPaise: 0, sgstPaise: 0, igstPaise: 0 };
    r.taxablePaise += l.taxablePaise;
    r.cgstPaise += l.cgstPaise;
    r.sgstPaise += l.sgstPaise;
    r.igstPaise += l.igstPaise;
    map.set(l.gstRateBp, r);
  }
  return [...map.values()].sort((a, b) => a.gstRateBp - b.gstRateBp);
}

const stateLabel = (code: string) => `${GST_STATES[code] ?? "Unknown"} (${code})`;

export async function loadInvoiceDoc(invoiceId: string, canteenId: string): Promise<PrintableDoc | null> {
  const inv = await prisma.invoice.findFirst({
    where: { id: invoiceId, canteenId },
    include: { lines: true, order: { select: { token: true } }, canteen: { include: { logo: true } } },
  });
  if (!inv) return null;
  const c = inv.canteen;
  const registered = inv.series === "INV";
  return {
    title: registered ? "TAX INVOICE" : "BILL OF SUPPLY",
    number: inv.number,
    issuedAt: inv.issuedAt,
    token: inv.order.token,
    paymentMode: inv.paymentMode,
    supplier: { name: c.name, address: c.address, gstin: registered ? c.gstin : null, state: stateLabel(inv.supplierState) },
    buyer: { name: inv.buyerName, gstin: inv.buyerGstin },
    placeOfSupply: stateLabel(inv.placeOfSupply),
    isInterState: inv.isInterState,
    registered,
    lines: inv.lines.map((l) => ({
      name: l.name,
      hsnSac: l.hsnSac,
      quantity: l.quantity,
      unitPricePaise: l.unitPricePaise,
      gstRateBp: l.gstRateBp,
      taxablePaise: l.taxablePaise,
      taxPaise: l.cgstPaise + l.sgstPaise + l.igstPaise,
      totalPaise: l.totalPaise,
    })),
    byRate: registered ? groupByRate(inv.lines) : [],
    taxablePaise: inv.taxablePaise,
    cgstPaise: inv.cgstPaise,
    sgstPaise: inv.sgstPaise,
    igstPaise: inv.igstPaise,
    roundOffPaise: inv.roundOffPaise,
    totalPaise: inv.totalPaise,
    upiLink: c.upiVpa ? upiPayLink({ vpa: c.upiVpa, payeeName: c.name, amountPaise: inv.totalPaise, note: inv.number }) : null,
    logo: c.logo ? { mime: c.logo.mime, data: c.logo.data } : null,
  };
}

export async function loadCreditNoteDoc(creditNoteId: string, canteenId: string): Promise<PrintableDoc | null> {
  const cn = await prisma.creditNote.findFirst({
    where: { id: creditNoteId, canteenId },
    include: { lines: { include: { invoiceLine: true } }, invoice: { include: { order: { select: { token: true } } } }, canteen: { include: { logo: true } } },
  });
  if (!cn) return null;
  const c = cn.canteen;
  const inv = cn.invoice;
  const registered = inv.series === "INV";
  return {
    title: "CREDIT NOTE",
    number: cn.number,
    issuedAt: cn.issuedAt,
    reference: `Against ${registered ? "invoice" : "bill"} ${inv.number}`,
    reason: cn.reason,
    token: inv.order.token,
    paymentMode: inv.paymentMode,
    supplier: { name: c.name, address: c.address, gstin: registered ? c.gstin : null, state: stateLabel(inv.supplierState) },
    buyer: { name: inv.buyerName, gstin: inv.buyerGstin },
    placeOfSupply: stateLabel(inv.placeOfSupply),
    isInterState: inv.isInterState,
    registered,
    lines: cn.lines.map((l) => ({
      name: l.invoiceLine.name,
      hsnSac: l.invoiceLine.hsnSac,
      quantity: l.quantity,
      unitPricePaise: l.invoiceLine.unitPricePaise,
      gstRateBp: l.invoiceLine.gstRateBp,
      taxablePaise: l.taxablePaise,
      taxPaise: l.cgstPaise + l.sgstPaise + l.igstPaise,
      totalPaise: l.totalPaise,
    })),
    byRate: registered ? groupByRate(cn.lines.map((l) => ({ ...l, gstRateBp: l.invoiceLine.gstRateBp }))) : [],
    taxablePaise: cn.taxablePaise,
    cgstPaise: cn.cgstPaise,
    sgstPaise: cn.sgstPaise,
    igstPaise: cn.igstPaise,
    roundOffPaise: cn.roundOffPaise,
    totalPaise: cn.totalPaise,
    upiLink: null,
    logo: c.logo ? { mime: c.logo.mime, data: c.logo.data } : null,
  };
}
