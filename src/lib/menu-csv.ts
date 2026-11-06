import { z } from "zod";
import { parseCsv } from "./csv";
import { parsePercentToBp, parseRupees } from "./money";

export const MENU_CSV_HEADER = [
  "name", "category", "veg", "price", "price_includes_gst", "gst_rate", "hsn_sac", "cost", "daily_qty", "prep_minutes",
] as const;

export const MENU_CSV_SAMPLE = [
  MENU_CSV_HEADER.join(","),
  "Masala Dosa,Meals,yes,45,yes,5,996331,18,60,6",
  "Egg Puff,Snacks,no,25,yes,5,996331,11,40,1",
  "Filter Coffee,Drinks,yes,15,yes,5,996331,5,150,2",
].join("\n");

const yes = new Set(["yes", "y", "true", "1", "veg"]);
const no = new Set(["no", "n", "false", "0", "non-veg", "nonveg"]);

const bool = (label: string) =>
  z.string().transform((v, ctx) => {
    const s = v.trim().toLowerCase();
    if (yes.has(s)) return true;
    if (no.has(s)) return false;
    ctx.addIssue({ code: "custom", message: `${label} must be yes or no` });
    return z.NEVER;
  });

const rupees = (label: string) =>
  z.string().transform((v, ctx) => {
    const p = parseRupees(v);
    if (p === null) {
      ctx.addIssue({ code: "custom", message: `${label} must be an amount like 45 or 45.50` });
      return z.NEVER;
    }
    return p;
  });

const int = (label: string, min: number, max: number) =>
  z.string().transform((v, ctx) => {
    const n = Number(v.trim());
    if (!Number.isInteger(n) || n < min || n > max) {
      ctx.addIssue({ code: "custom", message: `${label} must be a whole number from ${min} to ${max}` });
      return z.NEVER;
    }
    return n;
  });

export const menuCsvRowSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(60),
  category: z.string().trim().min(1, "category is required").max(30),
  veg: bool("veg"),
  price: rupees("price"),
  price_includes_gst: bool("price_includes_gst"),
  gst_rate: z.string().transform((v, ctx) => {
    const bp = parsePercentToBp(v);
    if (bp === null || bp > 4000) {
      ctx.addIssue({ code: "custom", message: "gst_rate must be a percentage like 5 or 18" });
      return z.NEVER;
    }
    return bp;
  }),
  hsn_sac: z.string().trim().regex(/^\d{4,8}$/, "hsn_sac must be 4 to 8 digits"),
  cost: rupees("cost"),
  daily_qty: int("daily_qty", 0, 10_000),
  prep_minutes: int("prep_minutes", 0, 120),
});

export type MenuCsvRow = z.output<typeof menuCsvRowSchema>;
export type MenuCsvResult = { rows: MenuCsvRow[]; errors: { line: number; message: string }[] };

/** Validates every row and reports problems by spreadsheet line number, so the owner can fix them in one pass. */
export function parseMenuCsv(text: string): MenuCsvResult {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], errors: [{ line: 1, message: "The file is empty." }] };

  const header = table[0].map((h) => h.trim().toLowerCase());
  const missing = MENU_CSV_HEADER.filter((h) => !header.includes(h));
  if (missing.length) return { rows: [], errors: [{ line: 1, message: `Missing columns: ${missing.join(", ")}` }] };

  const rows: MenuCsvRow[] = [];
  const errors: MenuCsvResult["errors"] = [];
  const seen = new Set<string>();

  table.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const record = Object.fromEntries(MENU_CSV_HEADER.map((h) => [h, cells[header.indexOf(h)] ?? ""]));
    const parsed = menuCsvRowSchema.safeParse(record);
    if (!parsed.success) {
      errors.push({ line, message: parsed.error.issues.map((e) => e.message).join("; ") });
      return;
    }
    const key = parsed.data.name.toLowerCase();
    if (seen.has(key)) {
      errors.push({ line, message: `"${parsed.data.name}" appears twice` });
      return;
    }
    seen.add(key);
    rows.push(parsed.data);
  });
  if (rows.length > 300) errors.push({ line: 1, message: "Import at most 300 items at a time." });
  return { rows, errors };
}
