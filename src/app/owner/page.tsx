import type { Metadata } from "next";
import { Panel, PageTitle } from "@/components/owner/page-title";
import { RangePicker } from "@/components/owner/range-picker";
import { SalesChart } from "@/components/owner/sales-chart";
import { SlotHeatmap } from "@/components/owner/slot-heatmap";
import { buttonClass } from "@/components/ui/button";
import { formatBp, formatPaise } from "@/lib/money";
import { percent } from "@/lib/report-format";
import { addDays, businessDate, isoDate } from "@/lib/time";
import { requireRole } from "@/server/auth";
import { defaultRange, ownerOverview, type OwnerOverview } from "@/server/owner-views";

export const metadata: Metadata = { title: "Today" };

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
      <PageTitle title="Today" subtitle={`Reports below cover ${data.range.from} to ${data.range.to}.`} actions={<RangePicker from={data.range.from} to={data.range.to} presets={presets()} />} />
      <TodayStrip today={data.today} />

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel title="Sales and profit per day" className="xl:col-span-2" action={<CsvLink href={`/api/reports/sales?${q}`} />}>
          <SalesChart sales={data.sales} />
        </Panel>
        <Panel title="Who uses it">
          <p className="num condensed text-6xl font-extrabold leading-none">{data.usage.students}</p>
          <p className="mt-1 text-ink-muted">students signed up</p>
          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <Stat label="Orders so far" value={String(data.usage.orders)} />
            <Stat label="One-tap reorders" value={String(data.usage.events.REORDER ?? 0)} />
            <Stat label="Push turned on" value={String(data.usage.events.PUSH_ENABLED ?? 0)} />
            <Stat label="Walk-in bills" value={String(data.usage.events.WALK_IN_BILLED ?? 0)} />
          </dl>
        </Panel>

        <Panel title={`GST by rate · ${data.month.label}`} className="xl:col-span-2" action={<CsvLink href={`/api/reports/gst?from=${data.month.from}&to=${data.month.to}`} />}>
          <GstTable rows={data.gst} />
        </Panel>
        <Panel title="No-shows" action={<CsvLink href={`/api/reports/waste?${q}`} label="Waste CSV" />}>
          <p className="num condensed text-6xl font-extrabold leading-none">{percent(data.noShows.rate)}</p>
          <p className="mt-1 text-ink-muted">
            {data.noShows.noShows} of {data.noShows.noShows + data.noShows.collected} pre-orders not collected
          </p>
          <p className="mt-4 text-sm">
            Food made for nobody: <span className="num font-semibold">{data.noShows.wastedUnits} items</span> costing <span className="num font-semibold">{formatPaise(data.noShows.wastedCostPaise, { trimWhole: true })}</span>
          </p>
          {data.waste.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm">
              {data.waste.slice(0, 5).map((w) => (
                <li key={w.name} className="flex justify-between gap-2">
                  <span className="truncate">{w.name}</span>
                  <span className="num text-ink-muted">{w.units} × · {formatPaise(w.costPaise, { trimWhole: true })}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Best sellers" className="xl:col-span-1" action={<CsvLink href={`/api/reports/items?${q}`} />}>
          <ItemList items={data.items.filter((i) => i.quantity > 0).slice(0, 6)} empty="No sales in this range yet." />
        </Panel>
        <Panel title="Slow movers" className="xl:col-span-2">
          <ItemList items={[...data.items].sort((a, b) => a.quantity - b.quantity).slice(0, 6)} empty="Add items to the menu to see this." />
        </Panel>
        <Panel title="When the rush is" className="xl:col-span-3" action={<CsvLink href={`/api/reports/slots?${q}`} />}>
          <SlotHeatmap cells={data.heatmap} />
        </Panel>
      </div>
    </>
  );
}

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
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-slip border border-line bg-line sm:grid-cols-3 xl:grid-cols-6">
      {cells.map((c) => (
        <div key={c.label} className={c.strong ? "bg-accent px-4 py-3 text-on-accent" : "bg-surface px-4 py-3"}>
          <dt className={c.strong ? "text-xs font-semibold" : "text-xs font-medium text-ink-muted"}>{c.label}</dt>
          <dd className={`num condensed mt-1 text-3xl font-extrabold ${c.warn ? "text-warn" : ""}`}>{c.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function GstTable({ rows }: { rows: OwnerOverview["gst"] }) {
  if (rows.length === 0) return <p className="text-sm text-ink-muted">No tax invoices this month. Bills of supply (not GST registered) don&apos;t appear here.</p>;
  const sum = (k: "taxablePaise" | "cgstPaise" | "sgstPaise" | "igstPaise") => rows.reduce((s, r) => s + r[k], 0);
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="num w-full min-w-[480px] text-sm">
        <thead className="text-left text-xs text-ink-muted">
          <tr className="border-b border-line">
            <th scope="col" className="py-2 font-medium">Rate</th>
            <th scope="col" className="py-2 text-right font-medium">Taxable value</th>
            <th scope="col" className="py-2 text-right font-medium">CGST</th>
            <th scope="col" className="py-2 text-right font-medium">SGST</th>
            <th scope="col" className="py-2 text-right font-medium">IGST</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.gstRateBp} className="border-b border-line">
              <th scope="row" className="py-2 text-left font-semibold">{formatBp(r.gstRateBp)}</th>
              <td className="py-2 text-right">{formatPaise(r.taxablePaise)}</td>
              <td className="py-2 text-right">{formatPaise(r.cgstPaise)}</td>
              <td className="py-2 text-right">{formatPaise(r.sgstPaise)}</td>
              <td className="py-2 text-right">{formatPaise(r.igstPaise)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="font-bold">
          <tr>
            <th scope="row" className="py-2 text-left">Total</th>
            <td className="py-2 text-right">{formatPaise(sum("taxablePaise"))}</td>
            <td className="py-2 text-right">{formatPaise(sum("cgstPaise"))}</td>
            <td className="py-2 text-right">{formatPaise(sum("sgstPaise"))}</td>
            <td className="py-2 text-right">{formatPaise(sum("igstPaise"))}</td>
          </tr>
        </tfoot>
      </table>
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
            <span className="num shrink-0 text-ink-muted">
              {i.quantity} sold · {formatPaise(i.salesPaise, { trimWhole: true })}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
            <div className="h-full rounded-full bg-ink/70" style={{ width: `${(i.quantity / max) * 100}%` }} />
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
      <dd className="num text-lg font-bold">{value}</dd>
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
