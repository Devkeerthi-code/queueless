import { NextResponse } from "next/server";
import { fresh, routeUser } from "@/server/http";
import { orderView } from "@/server/views";

/** Polled every few seconds by the token slip. */
export async function GET(_req: Request, ctx: RouteContext<"/api/orders/[id]">) {
  const user = await routeUser();
  if (user instanceof NextResponse) return user;
  const { id } = await ctx.params;
  const view = await orderView(id, { userId: user.id, role: user.role, canteenId: user.canteenId });
  if (!view) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  const { qrSvg: _qr, ...status } = view;
  return fresh(status);
}
