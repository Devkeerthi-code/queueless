import { describe, expect, it } from "vitest";
import { MENU_CSV_SAMPLE, parseMenuCsv } from "@/lib/menu-csv";

describe("menu CSV import", () => {
  it("parses the sample file into paise and basis points", () => {
    const { rows, errors } = parseMenuCsv(MENU_CSV_SAMPLE);
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ name: "Masala Dosa", veg: true, price: 4_500, price_includes_gst: true, gst_rate: 500, cost: 1_800, daily_qty: 60 });
    expect(rows[1].veg).toBe(false);
  });

  it("reports every bad row with its spreadsheet line number", () => {
    const csv = [
      "name,category,veg,price,price_includes_gst,gst_rate,hsn_sac,cost,daily_qty,prep_minutes",
      "Good,Meals,yes,40,yes,5,996331,10,10,5",
      "Bad price,Meals,yes,forty,yes,5,996331,10,10,5",
      "Bad veg,Meals,maybe,40,yes,5,996331,10,10,5",
      "good,Meals,yes,40,yes,5,996331,10,10,5",
    ].join("\n");
    const { rows, errors } = parseMenuCsv(csv);
    expect(rows).toHaveLength(1);
    expect(errors.map((e) => e.line)).toEqual([3, 4, 5]);
    expect(errors[2].message).toMatch(/twice/);
  });

  it("names missing columns", () => {
    expect(parseMenuCsv("name,price\nDosa,40").errors[0].message).toMatch(/Missing columns: category/);
  });
});
