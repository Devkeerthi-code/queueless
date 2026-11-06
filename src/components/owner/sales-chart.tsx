import { formatPaise } from "@/lib/money";
import type { OwnerOverview } from "@/server/owner-views";

const W = 720;
const H = 220;
const PAD = { top: 12, right: 8, bottom: 24, left: 8 };

const dayLabel = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/** Hand-rolled SVG: sales as ink bars, profit as a turmeric line. Every bar has a native tooltip. */
export function SalesChart({ sales }: { sales: OwnerOverview["sales"] }) {
  const max = Math.max(1, ...sales.map((d) => d.salesPaise));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const step = innerW / Math.max(1, sales.length);
  const barW = Math.max(2, step * 0.66);
  const y = (v: number) => PAD.top + innerH - (Math.max(0, v) / max) * innerH;
  const profitPoints = sales.map((d, i) => `${PAD.left + i * step + step / 2},${y(d.profitPaise)}`).join(" ");
  const totalSales = sales.reduce((s, d) => s + d.salesPaise, 0);
  const totalProfit = sales.reduce((s, d) => s + d.profitPaise, 0);
  const best = sales.reduce((a, b) => (b.salesPaise > a.salesPaise ? b : a), sales[0]);
  const labelEvery = Math.ceil(sales.length / 6);

  return (
    <figure>
      <div className="mb-4 flex flex-wrap gap-x-8 gap-y-2">
        <Figure label="Net sales" value={formatPaise(totalSales, { trimWhole: true })} swatch="bg-ink/80" />
        <Figure label="Profit (before GST)" value={formatPaise(totalProfit, { trimWhole: true })} swatch="bg-accent" />
      </div>
      <div className="-mx-5 overflow-x-auto px-5">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[560px]" role="img" aria-labelledby="sales-title sales-desc">
        <title id="sales-title">Daily net sales and profit</title>
        <desc id="sales-desc">
          {`${sales.length} days. Total sales ${formatPaise(totalSales)}, profit ${formatPaise(totalProfit)}.${best && best.salesPaise > 0 ? ` Best day ${best.day} with ${formatPaise(best.salesPaise)}.` : ""}`}
        </desc>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={PAD.left} x2={W - PAD.right} y1={PAD.top + innerH * (1 - f)} y2={PAD.top + innerH * (1 - f)} className="stroke-line" strokeDasharray="2 4" />
        ))}
        {sales.map((d, i) => (
          <g key={d.day}>
            <rect x={PAD.left + i * step + (step - barW) / 2} y={y(d.salesPaise)} width={barW} height={Math.max(0, PAD.top + innerH - y(d.salesPaise))} rx={1} className="fill-ink/80">
              <title>{`${dayLabel.format(new Date(`${d.day}T00:00:00Z`))}: sales ${formatPaise(d.salesPaise)}, profit ${formatPaise(d.profitPaise)}, ${d.invoices} bills`}</title>
            </rect>
            {i % labelEvery === 0 && (
              <text x={PAD.left + i * step + step / 2} y={H - 6} textAnchor="middle" className="fill-ink-muted font-mono text-[11px]">
                {dayLabel.format(new Date(`${d.day}T00:00:00Z`))}
              </text>
            )}
          </g>
        ))}
        <polyline points={profitPoints} fill="none" className="stroke-accent" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} className="stroke-ink/40" />
      </svg>
      </div>
    </figure>
  );
}

function Figure({ label, value, swatch }: { label: string; value: string; swatch: string }) {
  return (
    <div>
      <p className="flex items-center gap-2 text-xs font-medium text-ink-muted">
        <span className={`size-2.5 rounded-[2px] ${swatch}`} aria-hidden="true" />
        {label}
      </p>
      <p className="font-mono text-2xl font-bold">{value}</p>
    </div>
  );
}
