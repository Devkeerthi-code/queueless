"use client";

import type { SlotView } from "@/server/views";
import { cn } from "../ui/cn";

/** Upcoming slots as pills with a fill meter. Full slots stay visible (hatched) so people see why. */
export function upcomingSlots(slots: SlotView[]): SlotView[] {
  return slots.filter((s) => s.bookable || s.full);
}

export function SlotPicker({ slots, value, onChange }: { slots: SlotView[]; value: string | null; onChange: (startsAt: string) => void }) {
  const visible = upcomingSlots(slots);
  return (
    <fieldset>
      <legend className="sr-only">Pickup time</legend>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {visible.map((s) => {
          const fill = Math.min(1, s.booked / Math.max(1, s.capacity));
          const left = s.capacity - s.booked;
          return (
            <label key={s.startsAt} className={cn("press relative", !s.bookable && "cursor-not-allowed")}>
              <input
                type="radio"
                name="slot"
                value={s.startsAt}
                checked={value === s.startsAt}
                disabled={!s.bookable}
                onChange={() => onChange(s.startsAt)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "flex h-16 flex-col justify-between overflow-hidden rounded-slip border border-line bg-surface px-2.5 pb-2 pt-2 transition-colors duration-150",
                  "peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink",
                  !s.bookable && "hatched text-ink-muted",
                )}
              >
                <span className="num text-[15px] font-bold leading-none">{s.label}</span>
                <span className="text-[11px] font-medium leading-none opacity-80">{s.full ? "Full" : left <= 3 ? `${left} left` : "Open"}</span>
                <span aria-hidden="true" className="relative h-1 w-full overflow-hidden rounded-full bg-current/15">
                  <span className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-150" style={{ width: `${fill * 100}%` }} />
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
