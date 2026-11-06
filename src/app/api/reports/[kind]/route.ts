import { NextResponse } from "next/server";
import { z } from "zod";
import { toCsv } from "@/lib/csv";
import { formatBp } from "@/lib/money";
import { dayNames } from "@/lib/report-format";
import { formatMinute } from "@/lib/time";
import { routeUser } from "@/server/http";
import { dailySales, gstSummary, itemPerformance, slotHeatmap, wastedItems, type Range } from "@/server/reports";

const rupees = (paise: number) => (paise / 100).toFixed(2);
const dateParam = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** CSV exports for every owner report. Amounts are in rupees with two decimals for spreadsheets. */
export async function GET(req: Request, ctx: RouteContext<"/api/reports/[kind]">) {
  const user = await routeUser("reports:view");
  if (user instanceof NextResponse) return user;
  const { kind } = await ctx.params;
  const params = new URL(req.url).searchParams;
  const from = dateParam.safeParse(params.get("from"));
  const to = dateParam.safeParse(params.get("to"));
  if (!from.success || !to.success || from.data > to.data) return NextResponse.json({ error: "Pass from and to as YYYY-MM-DD." }, { status: 400 });
  const range: Range = { from: new Date(`${from.data}T00:00:00Z`), to: new Date(`${to.data}T00:00:00Z`) };
  if (range.to.getTime() - range.from.getTime() > 366 * 86_400_000) return NextResponse.json({ error: "Export at most a year at a time." }, { status: 400 });

  let csv: string;
  switch (kind) {
    case "sales": {
      const rows = await dailySales(user.canteenId, range);
      csv = toCsv(["date", "invoices", "net_sales", "taxable_value", "gst", "food_cost", "profit"], rows.map((r) => [r.day, r.invoices, rupees(r.salesPaise), rupees(r.taxablePaise), rupees(r.taxPaise), rupees(r.costPaise), rupees(r.profitPaise)]));
      break;
    }
    case "gst": {
      const rows = await gstSummary(user.canteenId, range);
      csv = toCsv(["gst_rate", "taxable_value", "cgst", "sgst", "igst", "total_tax"], rows.map((r) => [formatBp(r.gstRateBp), rupees(r.taxablePaise), rupees(r.cgstPaise), rupees(r.sgstPaise), rupees(r.igstPaise), rupees(r.cgstPaise + r.sgstPaise + r.igstPaise)]));
      break;
    }
    case "items": {
      const rows = await itemPerformance(user.canteenId, range);
      csv = toCsv(["item", "units_sold", "sales", "profit"], rows.map((r) => [r.name, r.quantity, rupees(r.salesPaise), rupees(r.profitPaise)]));
      break;
    }
    case "slots": {
      const rows = await slotHeatmap(user.canteenId, range);
      csv = toCsv(["weekday", "pickup_time", "orders"], rows.map((r) => [dayNames[r.weekday], formatMinute(r.minute), r.orders]));
      break;
    }
    case "waste": {
      const rows = await wastedItems(user.canteenId, range);
      csv = toCsv(["item", "units_wasted", "cost"], rows.map((r) => [r.name, r.units, rupees(r.costPaise)]));
      break;
    }
    default:
      return NextResponse.json({ error: "Unknown report." }, { status: 404 });
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="queueless-${kind}-${from.data}-to-${to.data}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
