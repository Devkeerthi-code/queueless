import "server-only";
import type { Db } from "./db";

/** Privacy-respecting usage counts: an event type and an internal user id, nothing else. */
export type UsageType =
  | "SIGNUP"
  | "LOGIN"
  | "ORDER_PLACED"
  | "REORDER"
  | "ORDER_COLLECTED"
  | "WALK_IN_BILLED"
  | "INVOICE_ISSUED"
  | "CREDIT_NOTE"
  | "MENU_IMPORTED"
  | "PUSH_ENABLED";

export async function track(db: Db, canteenId: string, type: UsageType, userId?: string | null): Promise<void> {
  try {
    await db.usageEvent.create({ data: { canteenId, type, userId: userId ?? null } });
  } catch (err) {
    // Tracking must never break the action it describes.
    console.error("usage tracking failed", err);
  }
}
