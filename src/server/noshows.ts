import "server-only";
import { NO_SHOW_LOOKBACK_DAYS } from "@/lib/noshow";
import { businessDate, isoDate } from "@/lib/time";
import type { Db } from "./db";
import { prisma, TX_OPTIONS } from "./db";
import { releaseStock } from "./inventory";

/** No-shows in the last 30 days, counting overdue orders the cleanup cron hasn't marked yet. */
export async function recentNoShowCount(db: Db, userId: string, graceMinutes: number, now: Date): Promise<number> {
  const since = new Date(now.getTime() - NO_SHOW_LOOKBACK_DAYS * 86_400_000);
  const overdueBefore = new Date(now.getTime() - graceMinutes * 60_000);
  const [row] = await db.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM "Order" o
    LEFT JOIN "PickupSlot" s ON s."id" = o."slotId"
    WHERE o."userId" = ${userId} AND o."placedAt" >= ${since}
      AND (o."status" = 'NO_SHOW'
           OR (o."status" IN ('PLACED', 'PREPARING', 'READY') AND s."endsAt" < ${overdueBefore}))`;
  return row.n;
}

/**
 * Writes NO_SHOW onto overdue orders. Unpaid orders the kitchen never started
 * give their stock back (only matters while it's still the same day). Paid
 * orders keep theirs: the money was taken and a credit note is the way back.
 */
export async function sweepNoShows(canteenId: string, now: Date): Promise<{ marked: number; restocked: number }> {
  const canteen = await prisma.canteen.findUniqueOrThrow({ where: { id: canteenId } });
  const overdueBefore = new Date(now.getTime() - canteen.noShowGraceMinutes * 60_000);
  const today = businessDate(now);

  return prisma.$transaction(async (tx) => {
    const overdue = await tx.$queryRaw<{ id: string; status: string; businessDate: Date; invoiced: boolean }[]>`
      SELECT o."id", o."status", o."businessDate", (i."id" IS NOT NULL) AS invoiced
      FROM "Order" o
      JOIN "PickupSlot" s ON s."id" = o."slotId"
      LEFT JOIN "Invoice" i ON i."orderId" = o."id"
      WHERE o."canteenId" = ${canteenId} AND o."status" IN ('PLACED', 'PREPARING', 'READY')
        AND s."endsAt" < ${overdueBefore}
      FOR UPDATE OF o`;

    let restocked = 0;
    for (const order of overdue) {
      const giveBack = order.status === "PLACED" && !order.invoiced && isoDate(order.businessDate) === isoDate(today);
      if (giveBack) {
        const lines = await tx.orderLine.findMany({ where: { orderId: order.id }, select: { itemId: true, quantity: true } });
        await releaseStock(tx, lines, today);
        restocked++;
      }
      await tx.order.update({
        where: { id: order.id },
        data: { status: "NO_SHOW", noShowAt: now, stockReleased: giveBack ? true : undefined },
      });
    }

    // Walk-ins are paid at the counter; anything still open from a previous day was handed over.
    await tx.order.updateMany({
      where: { canteenId, source: "WALK_IN", status: { in: ["PLACED", "PREPARING", "READY"] }, businessDate: { lt: today } },
      data: { status: "COLLECTED", collectedAt: now },
    });

    return { marked: overdue.length, restocked };
  }, TX_OPTIONS);
}
