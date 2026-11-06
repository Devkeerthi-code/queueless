import type { Metadata } from "next";
import { Panel, PageTitle } from "@/components/owner/page-title";
import { RangePicker } from "@/components/owner/range-picker";
import { SalesChart } from "@/components/owner/sales-chart";
import { SlotHeatmap } from "@/components/owner/slot-heatmap";
import { ZReport } from "@/components/owner/z-report";
import { cn } from "@/components/ui/cn";
import { buttonClass } from "@/components/ui/button";
import { formatPaise } from "@/lib/money";
import { addDays, businessDate, isoDate } from "@/lib/time";
import { requireRole } from "@/server/auth";
import { defaultRange, ownerOverview, type OwnerOverview } from "@/server/owner-views";

export const metadata: Metadata = { title: "Day book" };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 366;

function parseRange(from: unknown, to: unknown) {
  if (typeof from !== "string" || typeof to !== "string" || !DATE.test(from) || !DATE.test(to) || from > to) return defaultRange();
  const range = { from: new Date(`${from}T00:00:00Z`), to: new Date(`${to}T00:00:00Z`) };
  if (Number.isNaN(range.from.getTime()) || Number.isNaN(range.to.getTime()) || range.to.getTime() - range.from.getTime() > MAX_DAYS * 86_400_000) return defaultRange();
  return range;
}

function presets() {
  const today = businessDate(new Date());
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  return [
    { label: "7 days", from: isoDate(addDays(today, -6)), to: isoDate(today) },
    { label: "30 days", from: isoDate(addDays(today, -29)), to: isoDate(today) },
    { label: "This month", from: isoDate(monthStart), to: isoDate(today) },
  ];
}

export default async function OwnerHome({ searchParams }: PageProps<"/owner">) {
  const user = await requireRole("OWNER");
  const sp = await searchParams;
  const data = await ownerOverview(user.canteenId, parseRange(sp.from, sp.to));
  const q = `from=${data.range.from}&to=${data.range.to}`;

  return (
    <>
      <PageTitle title="Day book" subtitle={`Reports below cover ${data.range.from} to ${data.range.to}.`} actions={<RangePicker from={data.range.from} to={data.range.to} presets={presets()} />} />
      <TodayStrip today={data.today} />

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel title="Sales and profit per day" className="xl:col-span-2" action={<CsvLink href={`/api/reports/sales?${q}`} />}>
          <SalesChart sales={data.sales} />
        </Panel>
        <div className="xl:row-span-2">
          <ZReport data={data} csv={{ gst: `/api/reports/gst?from=${data.month.from}&to=${data.month.to}`, waste: `/api/reports/waste?${q}` }} />
        </div>
        <Panel title="Best sellers" edge="torn" action={<CsvLink href={`/api/reports/items?${q}`} />}>
          <ItemList items={data.items.filter((i) => i.quantity > 0).slice(0, 6)} empty="No sales in this range yet." />
        </Panel>
        <Panel title="Slow movers" edge="torn">
          <ItemList items={[...data.items].sort((a, b) => a.quantity - b.quantity).slice(0, 6)} empty="Add items to the menu to see this." />
        </Panel>
        <Panel title="When the rush is" className="xl:col-span-2" action={<CsvLink href={`/api/reports/slots?${q}`} />}>
          <SlotHeatmap cells={data.heatmap} />
        </Panel>
        <Panel title="Who uses it" edge="perf">
          <p className="condensed text-6xl font-extrabold leading-none">{data.usage.students}</p>
          <p className="mt-1 text-ink-muted">students signed up</p>
          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <Stat label="Orders so far" value={String(data.usage.orders)} />
            <Stat label="One-tap reorders" value={String(data.usage.events.REORDER ?? 0)} />
            <Stat label="Push turned on" value={String(data.usage.events.PUSH_ENABLED ?? 0)} />
            <Stat label="Walk-in bills" value={String(data.usage.events.WALK_IN_BILLED ?? 0)} />
          </dl>
        </Panel>
      </div>
    </>
  );
}

/** Today's line in the day book: ruled columns, figures in receipt type. */
function TodayStrip({ today }: { today: OwnerOverview["today"] }) {
  const cells = [
    { label: "Sales today", value: formatPaise(today.salesPaise, { trimWhole: true }), strong: true },
    { label: "Profit", value: formatPaise(today.profitPaise, { trimWhole: true }) },
    { label: "Orders", value: String(today.orders) },
    { label: "Bills", value: String(today.invoices) },
    { label: "No-shows", value: String(today.noShows), warn: today.noShows > 0 },
    { label: "Wasted items", value: String(today.wastedUnits), warn: today.wastedUnits > 0 },
  ];
  return (
    <div className="lift">
      <dl className="paper grid grid-cols-2 rounded-[3px] sm:grid-cols-3 xl:grid-cols-6">
        {cells.map((c) => (
          <div key={c.label} className={cn("border-b border-r border-line px-4 py-3", c.strong && "bg-accent text-on-accent")}>
            <dt className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em]">{c.label}</dt>
            <dd className={cn("mt-1 font-mono text-2xl font-bold", c.warn && "text-warn")}>{c.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ItemList({ items, empty }: { items: OwnerOverview["items"]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-ink-muted">{empty}</p>;
  const max = Math.max(1, ...items.map((i) => i.quantity));
  return (
    <ol className="space-y-2.5">
      {items.map((i) => (
        <li key={i.itemId} className="text-sm">
          <div className="flex justify-between gap-2">
            <span className="truncate font-medium">{i.name}</span>
            <span className="shrink-0 font-mono text-xs text-ink-muted">
              {i.quantity} sold · {formatPaise(i.salesPaise, { trimWhole: true })}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
            <div className="h-full bg-ink/70" style={{ width: `${(i.quantity / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-mono text-lg font-bold">{value}</dd>
    </div>
  );
}

function CsvLink({ href, label = "CSV" }: { href: string; label?: string }) {
  return (
    <a href={href} className={buttonClass("quiet", "sm", "-my-2 -mr-2 text-ink-muted")} download>
      {label} ↓
    </a>
  );
}
