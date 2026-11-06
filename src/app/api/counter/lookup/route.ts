import { NextResponse } from "next/server";
import { z } from "zod";
import { fresh, routeUser } from "@/server/http";
import { counterLookup } from "@/server/views";

const query = z.object({ code: z.string().max(200).optional(), token: z.string().max(10).optional() });

/** Finds an order from a scanned QR (signature verified) or a typed token. */
export async function GET(req: Request) {
  const user = await routeUser("counter:view");
  if (user instanceof NextResponse) return user;
  const params = query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!params.success) return NextResponse.json({ error: "Bad lookup." }, { status: 400 });
  const order = await counterLookup(user.canteenId, params.data);
  if (!order) {
    const msg = params.data.code ? "This QR isn't a valid QueueLess pickup code for this canteen." : "No order with that token today.";
    return NextResponse.json({ error: msg }, { status: 404 });
  }
  return fresh(order);
}
