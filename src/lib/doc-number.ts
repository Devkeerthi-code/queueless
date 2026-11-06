export type Series = "INV" | "BOS" | "CN";

const SERIES_TAG: Record<Series, string> = { INV: "", BOS: "B", CN: "C" };

/** GST rules cap invoice numbers at 16 characters of letters, digits, "-" and "/". */
export const MAX_DOC_NUMBER_LENGTH = 16;
export const INVOICE_PREFIX_PATTERN = /^[A-Z0-9]{1,4}$/;

/** "2026-27" -> "2627" so numbers fit the 16-character limit. */
export function shortFinancialYear(fy: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(fy);
  if (!m) throw new Error(`bad financial year ${fy}`);
  return `${m[1].slice(2)}${m[2]}`;
}

/** e.g. QL/2627/00042 (invoice), QLB/2627/00042 (bill of supply), QLC/2627/00003 (credit note). */
export function formatDocNumber(prefix: string, series: Series, fy: string, seq: number): string {
  if (!INVOICE_PREFIX_PATTERN.test(prefix)) throw new Error("invoice prefix must be 1-4 letters or digits");
  const number = `${prefix}${SERIES_TAG[series]}/${shortFinancialYear(fy)}/${String(seq).padStart(5, "0")}`;
  if (number.length > MAX_DOC_NUMBER_LENGTH) throw new Error("document number too long");
  return number;
}
