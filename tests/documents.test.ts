import { describe, expect, it } from "vitest";
import type { PrintableDoc } from "@/server/documents";
import { pdfSafe, renderDocPdf } from "@/server/pdf";
import { rupeesInWords } from "@/lib/words";

describe("amount in words", () => {
  it("uses Indian lakh/crore grouping", () => {
    expect(rupeesInWords(0)).toBe("Rupees Zero Only");
    expect(rupeesInWords(14_000)).toBe("Rupees One Hundred Forty Only");
    expect(rupeesInWords(1_23_456_00)).toBe("Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six Only");
    expect(rupeesInWords(2_00_00_000_00)).toBe("Rupees Two Crore Only");
    expect(rupeesInWords(4_550)).toBe("Rupees Forty Five and Fifty Paise Only");
  });
});

const doc: PrintableDoc = {
  title: "TAX INVOICE",
  number: "QL/2627/00042",
  issuedAt: new Date("2026-11-06T07:05:00Z"),
  token: "A23",
  paymentMode: "UPI",
  supplier: { name: "DEMO Canteen", address: "Block C, Demo College", gstin: "33ABCDE1234F1Z5", state: "Tamil Nadu (33)" },
  buyer: { name: null, gstin: null },
  placeOfSupply: "Tamil Nadu (33)",
  isInterState: false,
  registered: true,
  lines: [{ name: "Masala Dosa ₹", hsnSac: "996331", quantity: 2, unitPricePaise: 4_500, gstRateBp: 500, taxablePaise: 8_572, taxPaise: 428, totalPaise: 9_000 }],
  byRate: [{ gstRateBp: 500, taxablePaise: 8_572, cgstPaise: 214, sgstPaise: 214, igstPaise: 0 }],
  taxablePaise: 8_572,
  cgstPaise: 214,
  sgstPaise: 214,
  igstPaise: 0,
  roundOffPaise: 0,
  totalPaise: 9_000,
  upiLink: "upi://pay?pa=demo@upi&pn=DEMO&am=90.00&cu=INR",
  logo: null,
};

describe("invoice PDF", () => {
  it.each(["a4", "thermal"] as const)("renders a valid %s PDF", async (layout) => {
    const bytes = await renderDocPdf(doc, layout);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(1_000);
  });
  it("replaces characters the standard PDF fonts can't draw", () => {
    expect(pdfSafe("₹45 தோசை")).toBe("Rs.45 ");
  });
});
