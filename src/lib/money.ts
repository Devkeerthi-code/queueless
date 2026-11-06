/** Money is always integer paise. These helpers are the only place we convert. */

/** Integer division rounding half away from zero (commercial rounding). */
export function roundDiv(numerator: number, denominator: number): number {
  if (denominator <= 0) throw new Error("denominator must be positive");
  const sign = numerator < 0 ? -1 : 1;
  const n = Math.abs(numerator);
  return sign * Math.floor((2 * n + denominator) / (2 * denominator));
}

/** Rounds to the nearest whole rupee; 50 paise and above goes up. */
export function roundToRupee(paise: number): number {
  return roundDiv(paise, 100) * 100;
}

const inr = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inrWhole = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export function formatPaise(paise: number, opts: { symbol?: string; trimWhole?: boolean } = {}): string {
  const symbol = opts.symbol ?? "₹";
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(paise);
  const body = opts.trimWhole && abs % 100 === 0 ? inrWhole.format(abs / 100) : inr.format(abs / 100);
  return `${sign}${symbol}${body}`;
}

/** Parses "45", "45.5", "45.50" or "₹1,234.50" into paise. Returns null for anything else. */
export function parseRupees(input: string): number | null {
  const cleaned = input.replace(/[₹,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

/** "5" or "5.5" (%) into basis points. */
export function parsePercentToBp(input: string): number | null {
  const cleaned = input.replace(/[%\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function formatBp(bp: number): string {
  return `${(bp / 100).toString()}%`;
}
