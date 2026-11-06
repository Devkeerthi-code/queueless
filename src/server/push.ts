import "server-only";
import webpush from "web-push";
import { z } from "zod";
import { env, pushConfigured } from "@/lib/env";
import { prisma } from "./db";

let configured = false;

function ensureVapid(): boolean {
  if (!pushConfigured()) return false;
  if (!configured) {
    const e = env();
    webpush.setVapidDetails(e.VAPID_SUBJECT, e.NEXT_PUBLIC_VAPID_PUBLIC_KEY, e.VAPID_PRIVATE_KEY);
    configured = true;
  }
  return true;
}

export const subscriptionSchema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

export async function saveSubscription(userId: string, input: unknown) {
  const sub = subscriptionSchema.parse(input);
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  });
}

/** Best effort: a failed push must never block the kitchen. Dead subscriptions are pruned. */
export async function notifyOrderReady(userId: string, orderId: string, token: string): Promise<void> {
  if (!ensureVapid()) return;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  const payload = JSON.stringify({ title: `Your order ${token} is ready`, body: "Show your QR at the counter to collect it.", url: `/orders/${orderId}`, tag: orderId });

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 900 });
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => undefined);
        else console.error("push failed", status);
      }
    }),
  );
}
