import { dayNames } from "@/lib/report-format";
import { formatMinute } from "@/lib/time";
import type { OwnerOverview } from "@/server/owner-views";

/** Weekday by pickup time. Darker turmeric means more pre-orders, so the real rush is obvious. */
export function SlotHeatmap({ cells }: { cells: OwnerOverview["heatmap"] }) {
  if (cells.length === 0) return <p className="text-sm text-ink-muted">No pre-orders in this range yet.</p>;
  const minutes = [...new Set(cells.map((c) => c.minute))].sort((a, b) => a - b);
  const days = [1, 2, 3, 4, 5, 6, 0].filter((d) => cells.some((c) => c.weekday === d));
  const max = Math.max(...cells.map((c) => c.orders));
  const count = (d: number, m: number) => cells.find((c) => c.weekday === d && c.minute === m)?.orders ?? 0;
  const peak = cells.reduce((a, b) => (b.orders > a.orders ? b : a));

  return (
    <div>
      <p className="mb-3 text-sm">
        Busiest: <span className="font-semibold">{dayNames[peak.weekday]} {formatMinute(peak.minute)}</span> <span className="text-ink-muted">({peak.orders} orders)</span>
      </p>
      <div className="relative overflow-x-auto">
        <table className="border-separate border-spacing-1 text-xs">
          <caption className="sr-only">Pre-orders by weekday and pickup time</caption>
          <thead>
            <tr>
              <th scope="col" className="sr-only">
                Day
              </th>
              {minutes.map((m) => (
                <th key={m} scope="col" className="num whitespace-nowrap px-0.5 font-medium text-ink-muted [writing-mode:vertical-rl] rotate-180">
                  {formatMinute(m)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d}>
                <th scope="row" className="pr-2 text-left font-semibold text-ink-muted">
                  {dayNames[d]}
                </th>
                {minutes.map((m) => {
                  const n = count(d, m);
                  return (
                    <td key={m} className="size-7 rounded-[3px] text-center align-middle" style={{ background: n ? `color-mix(in oklab, var(--accent) ${Math.round(15 + (n / max) * 85)}%, var(--surface))` : "var(--sunken)" }}>
                      <span className="sr-only">{`${dayNames[d]} ${formatMinute(m)}: ${n} orders`}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
