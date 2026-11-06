import "server-only";
import { randomUUID } from "node:crypto";
import { isoDate } from "@/lib/time";
import type { Db, Tx } from "./db";
import { SlotFullError, SoldOutError } from "./errors";

export type Reservation = { itemId: string; name: string; quantity: number };

/** Creates today's stock rows from each item's daily quantity if they don't exist yet. Safe to race. */
export async function ensureDailyStock(db: Db, itemIds: string[], day: Date): Promise<void> {
  if (itemIds.length === 0) return;
  await db.$executeRaw`
    INSERT INTO "DailyStock" ("itemId", "businessDate", "capacity", "reserved")
    SELECT "id", ${isoDate(day)}::date, "dailyQuantity", 0 FROM "MenuItem" WHERE "id" = ANY(${itemIds}::text[])
    ON CONFLICT DO NOTHING`;
}

/**
 * Reserves stock with one conditional UPDATE per item. Postgres re-checks the
 * WHERE clause after taking the row lock, so concurrent orders queue on the
 * row and the loser sees the updated `reserved` and gets zero rows back.
 * Items are locked in id order so two multi-item orders can't deadlock.
 */
export async function reserveStock(tx: Tx, lines: Reservation[], day: Date): Promise<void> {
  const sorted = [...lines].sort((a, b) => a.itemId.localeCompare(b.itemId));
  await ensureDailyStock(tx, sorted.map((l) => l.itemId), day);
  for (const line of sorted) {
    const updated = await tx.$queryRaw<{ left: number }[]>`
      UPDATE "DailyStock" SET "reserved" = "reserved" + ${line.quantity}
      WHERE "itemId" = ${line.itemId} AND "businessDate" = ${isoDate(day)}::date
        AND "reserved" + ${line.quantity} <= "capacity"
      RETURNING "capacity" - "reserved" AS "left"`;
    if (updated.length === 0) {
      const [row] = await tx.$queryRaw<{ left: number }[]>`
        SELECT "capacity" - "reserved" AS "left" FROM "DailyStock"
        WHERE "itemId" = ${line.itemId} AND "businessDate" = ${isoDate(day)}::date`;
      throw new SoldOutError(line.name, Math.max(0, row?.left ?? 0));
    }
  }
}

/** Gives reserved units back. Clamped at zero so a double release can never go negative. */
export async function releaseStock(tx: Tx, lines: Omit<Reservation, "name">[], day: Date): Promise<void> {
  const sorted = [...lines].sort((a, b) => a.itemId.localeCompare(b.itemId));
  for (const line of sorted) {
    await tx.$executeRaw`
      UPDATE "DailyStock" SET "reserved" = GREATEST(0, "reserved" - ${line.quantity})
      WHERE "itemId" = ${line.itemId} AND "businessDate" = ${isoDate(day)}::date`;
  }
}

/** Books one order into a pickup slot, creating the slot row on first use. Returns the slot id. */
export async function bookSlot(
  tx: Tx,
  slot: { canteenId: string; startsAt: Date; endsAt: Date; capacity: number },
): Promise<string> {
  await tx.$executeRaw`
    INSERT INTO "PickupSlot" ("id", "canteenId", "startsAt", "endsAt", "capacity", "booked")
    VALUES (${randomUUID()}, ${slot.canteenId}, ${slot.startsAt}, ${slot.endsAt}, ${slot.capacity}, 0)
    ON CONFLICT ("canteenId", "startsAt") DO NOTHING`;
  const booked = await tx.$queryRaw<{ id: string }[]>`
    UPDATE "PickupSlot" SET "booked" = "booked" + 1
    WHERE "canteenId" = ${slot.canteenId} AND "startsAt" = ${slot.startsAt} AND "booked" < "capacity"
    RETURNING "id"`;
  if (booked.length === 0) throw new SlotFullError();
  return booked[0].id;
}

export async function releaseSlot(tx: Tx, slotId: string): Promise<void> {
  await tx.$executeRaw`UPDATE "PickupSlot" SET "booked" = GREATEST(0, "booked" - 1) WHERE "id" = ${slotId}`;
}

/** Remaining units today for each item. Items with no stock row yet have their full daily quantity left. */
export async function remainingToday(db: Db, canteenId: string, day: Date): Promise<Map<string, number>> {
  const rows = await db.$queryRaw<{ id: string; left: number }[]>`
    SELECT m."id", COALESCE(s."capacity" - s."reserved", m."dailyQuantity")::int AS "left"
    FROM "MenuItem" m
    LEFT JOIN "DailyStock" s ON s."itemId" = m."id" AND s."businessDate" = ${isoDate(day)}::date
    WHERE m."canteenId" = ${canteenId} AND m."archivedAt" IS NULL`;
  return new Map(rows.map((r) => [r.id, Math.max(0, r.left)]));
}

/** When the owner edits today's quantity, today's capacity follows, but never below what's already reserved. */
export async function syncTodayCapacity(db: Db, itemId: string, dailyQuantity: number, day: Date): Promise<void> {
  await db.$executeRaw`
    UPDATE "DailyStock" SET "capacity" = GREATEST("reserved", ${dailyQuantity})
    WHERE "itemId" = ${itemId} AND "businessDate" = ${isoDate(day)}::date`;
}
