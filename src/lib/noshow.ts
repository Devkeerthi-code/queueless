export type ActiveStatus = "PLACED" | "PREPARING" | "READY";
export type Status = ActiveStatus | "COLLECTED" | "CANCELLED" | "NO_SHOW";

const ACTIVE: readonly Status[] = ["PLACED", "PREPARING", "READY"];

export function isActive(status: Status): status is ActiveStatus {
  return ACTIVE.includes(status);
}

/** An uncollected order becomes a no-show `graceMinutes` after its slot ends. Walk-ins (no slot) never do. */
export function isOverdue(slotEndsAt: Date | null, now: Date, graceMinutes: number): boolean {
  if (!slotEndsAt) return false;
  return now.getTime() > slotEndsAt.getTime() + graceMinutes * 60_000;
}

/** Status as it should be shown right now, even before the cleanup cron has written it. */
export function effectiveStatus(status: Status, slotEndsAt: Date | null, now: Date, graceMinutes: number): Status {
  return isActive(status) && isOverdue(slotEndsAt, now, graceMinutes) ? "NO_SHOW" : status;
}

/** Students with this many no-shows in the lookback window pay before the kitchen starts their order. */
export function mustPrepay(recentNoShows: number, threshold: number): boolean {
  return threshold > 0 && recentNoShows >= threshold;
}

export const NO_SHOW_LOOKBACK_DAYS = 30;

/** A no-show counts as wasted food if the kitchen had already started it. */
export function isWasted(order: { status: Status; preparingAt: Date | null }): boolean {
  return order.status === "NO_SHOW" && order.preparingAt !== null;
}
