import Link from "next/link";
import { buttonClass } from "../ui/button";
import { inputClass } from "../ui/field";
import { cn } from "../ui/cn";

export type Preset = { label: string; from: string; to: string };

/** A plain GET form: the range lives in the URL, so it can be bookmarked and needs no client JS. */
export function RangePicker({ from, to, presets }: { from: string; to: string; presets: Preset[] }) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-2" aria-label="Report date range">
      <div className="flex gap-1">
        {presets.map((p) => (
          <Link
            key={p.label}
            href={`?from=${p.from}&to=${p.to}`}
            className={cn("press h-9 rounded-full border px-3 text-sm font-semibold leading-9", p.from === from && p.to === to ? "border-ink bg-ink text-on-ink" : "border-line text-ink-muted hover:text-ink")}
          >
            {p.label}
          </Link>
        ))}
      </div>
      <label className="flex w-40 flex-col text-xs font-medium text-ink-muted">
        From
        <input type="date" name="from" defaultValue={from} className={cn(inputClass, "font-mono h-9 text-sm")} />
      </label>
      <label className="flex w-40 flex-col text-xs font-medium text-ink-muted">
        To
        <input type="date" name="to" defaultValue={to} className={cn(inputClass, "font-mono h-9 text-sm")} />
      </label>
      <button type="submit" className={buttonClass("outline", "sm")}>
        Apply
      </button>
    </form>
  );
}
