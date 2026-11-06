import { istInstant, istParts } from "./time";

export type SlotRules = {
  openMinute: number;
  closeMinute: number;
  openDays: number[];
  slotMinutes: number;
  orderCutoffMinutes: number;
};

export type SlotWindow = { startsAt: Date; endsAt: Date; startMinute: number };

/** All pickup windows for a business day, back to back from opening to closing. */
export function slotsForDay(day: Date, rules: SlotRules): SlotWindow[] {
  if (!rules.openDays.includes(day.getUTCDay()) || rules.slotMinutes <= 0) return [];
  const windows: SlotWindow[] = [];
  for (let m = rules.openMinute; m + rules.slotMinutes <= rules.closeMinute; m += rules.slotMinutes) {
    windows.push({ startMinute: m, startsAt: istInstant(day, m), endsAt: istInstant(day, m + rules.slotMinutes) });
  }
  return windows;
}

/** Ordering for a slot closes `orderCutoffMinutes` before it starts. */
export function isSlotBookable(startsAt: Date, now: Date, rules: Pick<SlotRules, "orderCutoffMinutes">): boolean {
  return now.getTime() <= startsAt.getTime() - rules.orderCutoffMinutes * 60_000;
}

/** Validates that a requested start time is a real slot on that day. */
export function findSlot(day: Date, startsAt: Date, rules: SlotRules): SlotWindow | null {
  return slotsForDay(day, rules).find((s) => s.startsAt.getTime() === startsAt.getTime()) ?? null;
}

export function isOpenNow(now: Date, rules: Pick<SlotRules, "openMinute" | "closeMinute" | "openDays">): boolean {
  const p = istParts(now);
  return rules.openDays.includes(p.weekday) && p.minuteOfDay >= rules.openMinute && p.minuteOfDay < rules.closeMinute;
}
