import "server-only";
import { z } from "zod";
import { validateGstin } from "@/lib/gstin";
import { isActive, mustPrepay, type Status } from "@/lib/noshow";
import { assertCan } from "@/lib/permissions";
import { findSlot, isSlotBookable } from "@/lib/slots";
import { businessDate, isoDate } from "@/lib/time";
import { formatToken } from "@/lib/token";
import type { Actor } from "./actor";
import { issueInvoice, type Buyer } from "./billing";
import { prisma, TX_OPTIONS, type Tx } from "./db";
import { UserError } from "./errors";
import { bookSlot, releaseSlot, releaseStock, reserveStock } from "./inventory";
import { recentNoShowCount } from "./noshows";
import { notifyOrderReady } from "./push";
import { track } from "./usage";

const lineSchema = z.object({ itemId: z.string().min(1).max(40), quantity: z.number().int().min(1).max(20) });

export const placeOrderSchema = z.object({
  lines: z.array(lineSchema).min(1, "Your tray is empty.").max(15),
  slotStartsAt: z.iso.datetime(),
  isReorder: z.boolean().optional(),
});

export const walkInSchema = z.object({
  lines: z.array(lineSchema).min(1, "Add at least one item.").max(30),
  paymentMode: z.enum(["CASH", "UPI"]),
  buyerName: z.string().trim().max(80).optional(),
  buyerGstin: z.string().trim().max(15).optional(),
});

/** Merges duplicate item ids so one item can't be reserved twice in the same order. */
function mergeLines(lines: z.infer<typeof lineSchema>[]) {
  const merged = new Map<string, number>();
  for (const l of lines) merged.set(l.itemId, (merged.get(l.itemId) ?? 0) + l.quantity);
  return [...merged.entries()].map(([itemId, quantity]) => ({ itemId, quantity }));
}

async function loadSellableItems(canteenId: string, itemIds: string[]) {
  const items = await prisma.menuItem.findMany({ where: { id: { in: itemIds }, canteenId, archivedAt: null } });
  const byId = new Map(items.map((i) => [i.id, i]));
  for (const id of itemIds) {
    const item = byId.get(id);
    if (!item) throw new UserError("One of the items is no longer on the menu. Refresh and try again.");
    if (!item.isAvailable) throw new UserError(`${item.name} is unavailable right now.`, "SOLD_OUT");
  }
  return byId;
}

async function nextToken(tx: Tx, canteenId: string, day: Date) {
  const [row] = await tx.$queryRaw<{ lastSeq: number }[]>`
    INSERT INTO "TokenCounter" ("canteenId", "businessDate", "lastSeq") VALUES (${canteenId}, ${isoDate(day)}::date, 1)
    ON CONFLICT ("canteenId", "businessDate") DO UPDATE SET "lastSeq" = "TokenCounter"."lastSeq" + 1
    RETURNING "lastSeq"`;
  return { tokenSeq: row.lastSeq, token: formatToken(row.lastSeq) };
}

function snapshotLines(lines: { itemId: string; quantity: number }[], items: Awaited<ReturnType<typeof loadSellableItems>>) {
  return lines.map((l) => {
    const item = items.get(l.itemId)!;
    return {
      itemId: item.id,
      name: item.name,
      isVeg: item.isVeg,
      quantity: l.quantity,
      unitPricePaise: item.pricePaise,
      priceIncludesGst: item.priceIncludesGst,
      gstRateBp: item.gstRateBp,
      hsnSac: item.hsnSac,
      costPaise: item.costPaise,
    };
  });
}

/** Displayed estimate; the invoice recomputes exact GST from the same snapshot. */
function estimate(lines: ReturnType<typeof snapshotLines>) {
  return lines.reduce((sum, l) => {
    const gross = l.unitPricePaise * l.quantity;
    return sum + (l.priceIncludesGst ? gross : gross + Math.round((gross * l.gstRateBp) / 10_000));
  }, 0);
}

/**
 * Places a pre-order. Stock, slot capacity and the daily token are all taken
 * in one transaction: if any step fails, nothing is reserved.
 */
export async function placeOrder(actor: Actor, input: unknown, now = new Date()) {
  assertCan(actor.role, "order:place");
  const data = placeOrderSchema.parse(input);
  const canteen = await prisma.canteen.findUniqueOrThrow({ where: { id: actor.canteenId } });
  const day = businessDate(now);
  const startsAt = new Date(data.slotStartsAt);

  const slot = findSlot(day, startsAt, canteen);
  if (!slot) throw new UserError("That pickup time isn't one of today's slots.");
  if (!isSlotBookable(slot.startsAt, now, canteen)) {
    throw new UserError(`Ordering for that slot closed ${canteen.orderCutoffMinutes} minutes before it starts. Pick a later one.`);
  }

  const lines = mergeLines(data.lines);
  const items = await loadSellableItems(canteen.id, lines.map((l) => l.itemId));
  const snapshot = snapshotLines(lines, items);
  const noShows = await recentNoShowCount(prisma, actor.userId, canteen.noShowGraceMinutes, now);

  const order = await prisma.$transaction(async (tx) => {
    await reserveStock(tx, snapshot.map((l) => ({ itemId: l.itemId, name: l.name, quantity: l.quantity })), day);
    const slotId = await bookSlot(tx, { canteenId: canteen.id, startsAt: slot.startsAt, endsAt: slot.endsAt, capacity: canteen.maxOrdersPerSlot });
    const token = await nextToken(tx, canteen.id, day);
    return tx.order.create({
      data: {
        canteenId: canteen.id,
        userId: actor.userId,
        source: "ONLINE",
        businessDate: day,
        ...token,
        slotId,
        requiresPrepay: mustPrepay(noShows, canteen.noShowThreshold),
        estimatePaise: estimate(snapshot),
        placedAt: now,
        lines: { create: snapshot },
      },
      select: { id: true, token: true, requiresPrepay: true },
    });
  }, TX_OPTIONS);

  await track(prisma, canteen.id, data.isReorder ? "REORDER" : "ORDER_PLACED", actor.userId);
  return order;
}

async function lockOrder(tx: Tx, orderId: string, canteenId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Order" WHERE "id" = ${orderId} AND "canteenId" = ${canteenId} FOR UPDATE`;
  if (rows.length === 0) throw new UserError("Order not found.", "NOT_FOUND");
  return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { lines: true, invoice: { select: { id: true } }, slot: true } });
}

/** Cancels an order that hasn't been paid for, giving back its stock and slot place. */
export async function cancelOrder(actor: Actor, orderId: string, now = new Date()) {
  await prisma.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId, actor.canteenId);
    if (!isActive(order.status as Status)) throw new UserError("This order is already closed.");
    const own = order.userId === actor.userId;
    if (own && actor.role === "STUDENT") {
      assertCan(actor.role, "order:cancel-own");
      if (order.status !== "PLACED") throw new UserError("The kitchen has already started this order, so it can't be cancelled here. Talk to the counter.");
    } else {
      assertCan(actor.role, "order:cancel-any");
    }
    if (order.invoice) throw new UserError("This order has been billed. The owner can refund it with a credit note.");

    if (!order.stockReleased) await releaseStock(tx, order.lines, order.businessDate);
    if (order.slotId && order.slot && order.slot.endsAt > now) await releaseSlot(tx, order.slotId);
    await tx.order.update({ where: { id: order.id }, data: { status: "CANCELLED", cancelledAt: now, stockReleased: true } });
  }, TX_OPTIONS);
}

/** Kitchen moves an order forward one step. The status check in WHERE makes double taps harmless. */
export async function advanceOrder(actor: Actor, orderId: string, now = new Date()) {
  assertCan(actor.role, "kitchen:advance");
  const order = await prisma.order.findFirst({ where: { id: orderId, canteenId: actor.canteenId } });
  if (!order) throw new UserError("Order not found.", "NOT_FOUND");

  if (order.status === "PLACED") {
    if (order.requiresPrepay && !order.paidAt) throw new UserError(`${order.token} must pay at the counter before you start it.`, "PAY_FIRST");
    await prisma.order.updateMany({ where: { id: order.id, status: "PLACED" }, data: { status: "PREPARING", preparingAt: now } });
    return { status: "PREPARING" as const };
  }
  if (order.status === "PREPARING") {
    const { count } = await prisma.order.updateMany({ where: { id: order.id, status: "PREPARING" }, data: { status: "READY", readyAt: now } });
    if (count === 1 && order.userId) await notifyOrderReady(order.userId, order.id, order.token);
    return { status: "READY" as const };
  }
  throw new UserError(`${order.token} is already ${order.status.toLowerCase().replace("_", " ")}.`);
}

/** Takes payment before the kitchen starts (for students flagged for repeated no-shows). Issues the invoice. */
export async function takePayment(actor: Actor, orderId: string, paymentMode: "CASH" | "UPI", now = new Date()) {
  assertCan(actor.role, "counter:collect");
  return prisma.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId, actor.canteenId);
    if (!isActive(order.status as Status)) throw new UserError("This order is already closed.");
    const invoice = await issueInvoice(tx, { orderId: order.id, issuedById: actor.userId, paymentMode, now });
    await tx.order.update({ where: { id: order.id }, data: { paidAt: order.paidAt ?? now, paymentMode } });
    return invoice;
  }, TX_OPTIONS);
}

/**
 * Hands the order over. This is the moment the invoice is issued for normal
 * pre-orders, so cancelled and no-show orders never consume a number.
 */
export async function collectOrder(actor: Actor, orderId: string, paymentMode: "CASH" | "UPI", now = new Date()) {
  assertCan(actor.role, "counter:collect");
  const result = await prisma.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId, actor.canteenId);
    if (order.status === "COLLECTED") throw new UserError(`${order.token} was already handed over.`, "ALREADY_COLLECTED");
    if (!isActive(order.status as Status)) throw new UserError(`${order.token} is ${order.status.toLowerCase().replace("_", "-")} and can't be handed over.`);
    const invoice = await issueInvoice(tx, { orderId: order.id, issuedById: actor.userId, paymentMode, now });
    await tx.order.update({
      where: { id: order.id },
      data: { status: "COLLECTED", collectedAt: now, paidAt: order.paidAt ?? now, paymentMode: order.paymentMode ?? paymentMode },
    });
    return { invoice, canteenId: order.canteenId, userId: order.userId };
  }, TX_OPTIONS);
  await track(prisma, result.canteenId, "ORDER_COLLECTED", result.userId);
  return result.invoice;
}

/** Bills a walk-in at the counter: reserves stock, issues the invoice and sends it to the kitchen. */
export async function billWalkIn(actor: Actor, input: unknown, now = new Date()) {
  assertCan(actor.role, "counter:walk-in");
  const data = walkInSchema.parse(input);
  const canteen = await prisma.canteen.findUniqueOrThrow({ where: { id: actor.canteenId } });

  let buyer: Buyer | undefined;
  if (data.buyerGstin) {
    const check = validateGstin(data.buyerGstin);
    if (!check.ok) throw new UserError(`Buyer GSTIN: ${check.reason}`);
    buyer = { name: data.buyerName, gstin: data.buyerGstin.toUpperCase(), stateCode: check.stateCode };
  } else if (data.buyerName) {
    buyer = { name: data.buyerName };
  }

  const day = businessDate(now);
  const lines = mergeLines(data.lines);
  const items = await loadSellableItems(canteen.id, lines.map((l) => l.itemId));
  const snapshot = snapshotLines(lines, items);

  const result = await prisma.$transaction(async (tx) => {
    await reserveStock(tx, snapshot.map((l) => ({ itemId: l.itemId, name: l.name, quantity: l.quantity })), day);
    const token = await nextToken(tx, canteen.id, day);
    const order = await tx.order.create({
      data: {
        canteenId: canteen.id,
        source: "WALK_IN",
        businessDate: day,
        ...token,
        estimatePaise: estimate(snapshot),
        paymentMode: data.paymentMode,
        paidAt: now,
        placedAt: now,
        lines: { create: snapshot },
      },
      select: { id: true, token: true },
    });
    const invoice = await issueInvoice(tx, { orderId: order.id, issuedById: actor.userId, paymentMode: data.paymentMode, buyer, now });
    return { order, invoice };
  }, TX_OPTIONS);

  await track(prisma, canteen.id, "WALK_IN_BILLED", actor.userId);
  return result;
}
