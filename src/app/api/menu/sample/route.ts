import { MENU_CSV_SAMPLE } from "@/lib/menu-csv";

export function GET() {
  return new Response(MENU_CSV_SAMPLE + "\n", {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="queueless-menu-sample.csv"' },
  });
}
