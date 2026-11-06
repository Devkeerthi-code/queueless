"use client";

import type { SlotView } from "@/server/views";
import { cn } from "../ui/cn";

/** Upcoming slots. Full ones stay visible, stamped FULL, so people see why they can't pick them. */
export function upcomingSlots(slots: SlotView[]): SlotView[] {
  return slots.filter((s) => s.bookable || s.full);
}

/** A strip of perforated time tickets. One tap picks one. */
export function SlotPicker({ slots, value, onChange }: { slots: SlotView[]; value: string | null; onChange: (startsAt: string) => void }) {
  const visible = upcomingSlots(slots);
  return (
    <fieldset>
      <legend className="sr-only">Pickup time</legend>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {visible.map((s) => {
          const fill = Math.min(1, s.booked / Math.max(1, s.capacity));
          const left = s.capacity - s.booked;
          const chosen = value === s.startsAt;
          return (
            <label key={s.startsAt} className={cn("press relative", !s.bookable && "cursor-not-allowed")}>
              <input type="radio" name="slot" value={s.startsAt} checked={chosen} disabled={!s.bookable} onChange={() => onChange(s.startsAt)} className="peer sr-only" />
              <span
                className={cn(
                  "edge-perf-x flex h-[4.5rem] flex-col justify-between px-3 pb-2 pt-2 transition-colors duration-150",
                  chosen ? "bg-accent text-on-accent" : "bg-sunken",
                  !s.bookable && "text-ink-muted",
                )}
              >
                <span className="condensed text-xl font-extrabold leading-none">{s.label}</span>
                <span className="font-mono text-[11px] font-medium">{s.full ? "—" : left <= 3 ? `${left} left` : "open"}</span>
                <span aria-hidden="true" className="relative h-1 w-full overflow-hidden rounded-full bg-black/10">
                  <span className="absolute inset-y-0 left-0 rounded-full bg-ink/70 transition-[width] duration-150" style={{ width: `${fill * 100}%` }} />
                </span>
              </span>
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[2px] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink" />
              {s.full && (
                <span className="pointer-events-none absolute inset-0 grid place-items-center">
                  <span className="rubber-stamp -rotate-12 bg-transparent text-lg text-danger">Full</span>
                </span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
