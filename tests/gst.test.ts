import { describe, expect, it } from "vitest";
import { computeBill, computeLine, taxModeFor, type BillLineInput } from "@/lib/gst";

const line = (over: Partial<BillLineInput>): BillLineInput => ({
  key: "k",
  name: "Item",
  hsnSac: "996331",
  quantity: 1,
  unitPricePaise: 10_000,
  priceIncludesGst: false,
  gstRateBp: 500,
  ...over,
});

describe("taxModeFor", () => {
  it("uses CGST+SGST within the state, IGST across states, nothing when unregistered", () => {
    expect(taxModeFor(true, "33", "33")).toBe("INTRA_STATE");
    expect(taxModeFor(true, "33", "29")).toBe("INTER_STATE");
    expect(taxModeFor(false, "33", "29")).toBe("UNREGISTERED");
  });
});

describe("computeLine", () => {
  it("adds GST on top of an exclusive price, split equally into CGST and SGST", () => {
    const l = computeLine(line({ unitPricePaise: 10_000, quantity: 2 }), "INTRA_STATE");
    expect(l).toMatchObject({ taxablePaise: 20_000, cgstPaise: 500, sgstPaise: 500, igstPaise: 0, totalPaise: 21_000 });
  });

  it("charges the whole rate as IGST inter-state", () => {
    const l = computeLine(line({ unitPricePaise: 10_000 }), "INTER_STATE");
    expect(l).toMatchObject({ taxablePaise: 10_000, cgstPaise: 0, sgstPaise: 0, igstPaise: 500, totalPaise: 10_500 });
  });

  it("backs GST out of an inclusive price and keeps the line total equal to the menu price", () => {
    // ₹45 inclusive of 5%: taxable 42.86, CGST 1.07, SGST 1.07
    const l = computeLine(line({ unitPricePaise: 4_500, priceIncludesGst: true }), "INTRA_STATE");
    expect(l.totalPaise).toBe(4_500);
    expect(l.cgstPaise).toBe(l.sgstPaise);
    expect(l.cgstPaise).toBe(107);
    expect(l.taxablePaise).toBe(4_286);
    expect(l.taxablePaise + l.cgstPaise + l.sgstPaise).toBe(4_500);
  });

  it("backs IGST out of an inclusive price", () => {
    const l = computeLine(line({ unitPricePaise: 11_800, priceIncludesGst: true, gstRateBp: 1_800 }), "INTER_STATE");
    expect(l).toMatchObject({ taxablePaise: 10_000, igstPaise: 1_800, totalPaise: 11_800 });
  });

  it("treats a 0% item as fully taxable with no tax", () => {
    const l = computeLine(line({ gstRateBp: 0, unitPricePaise: 2_000 }), "INTRA_STATE");
    expect(l).toMatchObject({ taxablePaise: 2_000, cgstPaise: 0, sgstPaise: 0, totalPaise: 2_000 });
  });

  it("rounds each tax half up to the paisa", () => {
    // 2.5% of ₹0.30 = 0.75 paise -> 1 paisa each side
    const l = computeLine(line({ unitPricePaise: 30, gstRateBp: 500 }), "INTRA_STATE");
    expect(l.cgstPaise).toBe(1);
    expect(l.sgstPaise).toBe(1);
  });

  it("rejects fractional quantities and non-integer paise", () => {
    expect(() => computeLine(line({ quantity: 1.5 }), "INTRA_STATE")).toThrow();
    expect(() => computeLine(line({ unitPricePaise: 10.5 }), "INTRA_STATE")).toThrow();
  });
});

describe("computeBill", () => {
  it("handles several GST rates on one bill and summarises by rate", () => {
    const bill = computeBill(
      [
        line({ key: "a", unitPricePaise: 4_500, priceIncludesGst: true, gstRateBp: 500, quantity: 2 }),
        line({ key: "b", unitPricePaise: 2_000, priceIncludesGst: false, gstRateBp: 1_800, quantity: 1 }),
        line({ key: "c", unitPricePaise: 1_500, priceIncludesGst: true, gstRateBp: 500, quantity: 1 }),
      ],
      "INTRA_STATE",
    );
    expect(bill.byRate.map((r) => r.gstRateBp)).toEqual([500, 1_800]);
    const five = bill.byRate[0];
    expect(five.taxablePaise).toBe(bill.lines[0].taxablePaise + bill.lines[2].taxablePaise);
    expect(bill.byRate[1]).toMatchObject({ taxablePaise: 2_000, cgstPaise: 180, sgstPaise: 180 });
    expect(bill.taxablePaise + bill.cgstPaise + bill.sgstPaise).toBe(bill.grossPaise);
    expect(bill.grossPaise).toBe(9_000 + 2_360 + 1_500);
  });

  it("rounds the invoice total to the nearest rupee and records the round-off", () => {
    const up = computeBill([line({ unitPricePaise: 1_000, gstRateBp: 500 }), line({ key: "2", unitPricePaise: 950, gstRateBp: 0 })], "INTRA_STATE");
    // 10.50 + 9.50 = 20.00 exactly
    expect(up.roundOffPaise).toBe(0);

    const half = computeBill([line({ unitPricePaise: 4_762, gstRateBp: 500 })], "INTRA_STATE");
    // 47.62 + 1.19 + 1.19 = 50.00
    expect(half.grossPaise).toBe(5_000);

    const odd = computeBill([line({ unitPricePaise: 1_000, gstRateBp: 1_200, quantity: 1 })], "INTRA_STATE");
    // 10.00 + 0.60 + 0.60 = 11.20 -> 11.00
    expect(odd.grossPaise).toBe(1_120);
    expect(odd.totalPaise).toBe(1_100);
    expect(odd.roundOffPaise).toBe(-20);

    const fifty = computeBill([line({ unitPricePaise: 1_050, gstRateBp: 0 })], "INTRA_STATE");
    expect(fifty.totalPaise).toBe(1_100);
    expect(fifty.roundOffPaise).toBe(50);
  });

  it("produces a Bill of Supply with no tax when the canteen isn't GST registered", () => {
    const bill = computeBill(
      [line({ unitPricePaise: 4_500, priceIncludesGst: true }), line({ key: "2", unitPricePaise: 2_000, priceIncludesGst: false, gstRateBp: 1_800 })],
      "UNREGISTERED",
    );
    expect(bill.cgstPaise + bill.sgstPaise + bill.igstPaise).toBe(0);
    expect(bill.byRate).toEqual([]);
    expect(bill.totalPaise).toBe(6_500);
    expect(bill.taxablePaise).toBe(6_500);
  });

  it("never drifts by a paisa: inclusive bills total exactly what the menu showed", () => {
    for (let price = 100; price <= 30_000; price += 37) {
      for (const rate of [0, 500, 1_200, 1_800, 2_800]) {
        const l = computeLine(line({ unitPricePaise: price, priceIncludesGst: true, gstRateBp: rate, quantity: 3 }), "INTRA_STATE");
        expect(l.taxablePaise + l.cgstPaise + l.sgstPaise).toBe(price * 3);
        expect(l.cgstPaise).toBe(l.sgstPaise);
      }
    }
  });
});
