import { roundDiv, roundToRupee } from "./money";

export type BillLineInput = {
  key: string;
  name: string;
  hsnSac: string;
  quantity: number;
  unitPricePaise: number;
  priceIncludesGst: boolean;
  gstRateBp: number;
};

export type TaxMode = "INTRA_STATE" | "INTER_STATE" | "UNREGISTERED";

export type BillLine = BillLineInput & {
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
};

export type RateSummary = {
  gstRateBp: number;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
};

export type Bill = {
  mode: TaxMode;
  lines: BillLine[];
  byRate: RateSummary[];
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  /** Sum of line totals before rounding the invoice to a whole rupee. */
  grossPaise: number;
  roundOffPaise: number;
  totalPaise: number;
};

export function taxModeFor(gstRegistered: boolean, supplierState: string, placeOfSupply: string): TaxMode {
  if (!gstRegistered) return "UNREGISTERED";
  return supplierState === placeOfSupply ? "INTRA_STATE" : "INTER_STATE";
}

/** Tax on a taxable value at `rateBp`, rounded to the paisa. */
function taxOn(taxablePaise: number, rateBp: number): number {
  return roundDiv(taxablePaise * rateBp, 10_000);
}

/**
 * GST for one line. For GST-inclusive prices we work backwards from the
 * price, then fix the taxable value so taxable + tax equals exactly what the
 * student was shown. CGST and SGST are each computed at half the rate on the
 * same taxable value so they are always equal.
 */
export function computeLine(line: BillLineInput, mode: TaxMode): BillLine {
  if (!Number.isInteger(line.quantity) || line.quantity <= 0) throw new Error("quantity must be a positive integer");
  if (!Number.isInteger(line.unitPricePaise) || line.unitPricePaise < 0) throw new Error("price must be integer paise");
  if (!Number.isInteger(line.gstRateBp) || line.gstRateBp < 0) throw new Error("rate must be integer basis points");

  const gross = line.unitPricePaise * line.quantity;
  const zero = { cgstPaise: 0, sgstPaise: 0, igstPaise: 0 };

  if (mode === "UNREGISTERED" || line.gstRateBp === 0) {
    return { ...line, ...zero, taxablePaise: gross, totalPaise: gross };
  }

  const splitTax = (taxable: number) => {
    if (mode === "INTER_STATE") return { ...zero, igstPaise: taxOn(taxable, line.gstRateBp) };
    // Multiply first, divide once, so odd basis-point rates halve exactly.
    const half = roundDiv(taxable * line.gstRateBp, 20_000);
    return { ...zero, cgstPaise: half, sgstPaise: half };
  };

  if (!line.priceIncludesGst) {
    const tax = splitTax(gross);
    const total = gross + tax.cgstPaise + tax.sgstPaise + tax.igstPaise;
    return { ...line, ...tax, taxablePaise: gross, totalPaise: total };
  }

  const estimatedTaxable = roundDiv(gross * 10_000, 10_000 + line.gstRateBp);
  const tax = splitTax(estimatedTaxable);
  const taxable = gross - tax.cgstPaise - tax.sgstPaise - tax.igstPaise;
  return { ...line, ...tax, taxablePaise: taxable, totalPaise: gross };
}

function summariseByRate(lines: BillLine[]): RateSummary[] {
  const map = new Map<number, RateSummary>();
  for (const l of lines) {
    const row = map.get(l.gstRateBp) ?? { gstRateBp: l.gstRateBp, taxablePaise: 0, cgstPaise: 0, sgstPaise: 0, igstPaise: 0 };
    row.taxablePaise += l.taxablePaise;
    row.cgstPaise += l.cgstPaise;
    row.sgstPaise += l.sgstPaise;
    row.igstPaise += l.igstPaise;
    map.set(l.gstRateBp, row);
  }
  return [...map.values()].sort((a, b) => a.gstRateBp - b.gstRateBp);
}

const sum = (lines: BillLine[], pick: (l: BillLine) => number) => lines.reduce((acc, l) => acc + pick(l), 0);

/** Computes a full bill. The payable total is rounded to the nearest rupee and the difference shown as round-off. */
export function computeBill(inputs: BillLineInput[], mode: TaxMode): Bill {
  const lines = inputs.map((l) => computeLine(l, mode));
  const grossPaise = sum(lines, (l) => l.totalPaise);
  const totalPaise = roundToRupee(grossPaise);
  return {
    mode,
    lines,
    byRate: mode === "UNREGISTERED" ? [] : summariseByRate(lines),
    taxablePaise: sum(lines, (l) => l.taxablePaise),
    cgstPaise: sum(lines, (l) => l.cgstPaise),
    sgstPaise: sum(lines, (l) => l.sgstPaise),
    igstPaise: sum(lines, (l) => l.igstPaise),
    grossPaise,
    roundOffPaise: totalPaise - grossPaise,
    totalPaise,
  };
}
