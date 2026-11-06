"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "@/server/auth";
import { prisma } from "@/server/db";
import { runAction, UserError, type ActionResult } from "@/server/errors";
import { billWalkIn, cancelOrder, collectOrder, placeOrder, takePayment, advanceOrder } from "@/server/orders";
import { setAvailability } from "@/server/menu";
import { saveSubscription } from "@/server/push";
import { track } from "@/server/usage";

const id = z.string().min(1).max(40);
const paymentMode = z.enum(["CASH", "UPI"]);

export async function placeOrderAction(input: unknown): Promise<ActionResult<{ id: string; token: string; requiresPrepay: boolean }>> {
  return runAction(async () => {
    const actor = await requireActor("order:place");
    const order = await placeOrder(actor, input);
    revalidatePath("/menu");
    return order;
  });
}

export async function cancelOrderAction(orderId: string): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    await cancelOrder(actor, id.parse(orderId));
    revalidatePath("/menu");
    return undefined;
  });
}

export async function toggleFavouriteAction(itemId: string): Promise<ActionResult<{ favourite: boolean }>> {
  return runAction(async () => {
    const actor = await requireActor("order:place");
    const key = { userId: actor.userId, itemId: id.parse(itemId) };
    const item = await prisma.menuItem.findFirst({ where: { id: key.itemId, canteenId: actor.canteenId } });
    if (!item) throw new UserError("Item not found.");
    const existing = await prisma.favourite.findUnique({ where: { userId_itemId: key } });
    if (existing) await prisma.favourite.delete({ where: { userId_itemId: key } });
    else await prisma.favourite.create({ data: key });
    return { favourite: !existing };
  });
}

export async function advanceOrderAction(orderId: string): Promise<ActionResult<{ status: "PREPARING" | "READY" }>> {
  return runAction(async () => advanceOrder(await requireActor("kitchen:advance"), id.parse(orderId)));
}

export async function setAvailabilityAction(itemId: string, isAvailable: boolean): Promise<ActionResult> {
  return runAction(async () => {
    await setAvailability(await requireActor("menu:toggle-availability"), id.parse(itemId), z.boolean().parse(isAvailable));
    revalidatePath("/menu");
    return undefined;
  });
}

export async function collectOrderAction(orderId: string, mode: "CASH" | "UPI"): Promise<ActionResult<{ id: string; number: string; totalPaise: number }>> {
  return runAction(async () => collectOrder(await requireActor("counter:collect"), id.parse(orderId), paymentMode.parse(mode)));
}

export async function takePaymentAction(orderId: string, mode: "CASH" | "UPI"): Promise<ActionResult<{ id: string; number: string; totalPaise: number }>> {
  return runAction(async () => takePayment(await requireActor("counter:collect"), id.parse(orderId), paymentMode.parse(mode)));
}

export async function walkInAction(input: unknown): Promise<ActionResult<{ token: string; invoiceId: string; number: string; totalPaise: number }>> {
  return runAction(async () => {
    const { order, invoice } = await billWalkIn(await requireActor("counter:walk-in"), input);
    return { token: order.token, invoiceId: invoice.id, number: invoice.number, totalPaise: invoice.totalPaise };
  });
}

export async function savePushSubscriptionAction(subscription: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    await saveSubscription(actor.userId, subscription);
    await track(prisma, actor.canteenId, "PUSH_ENABLED", actor.userId);
    return undefined;
  });
}
