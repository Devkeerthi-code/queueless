import { NextResponse } from "next/server";
import { fresh, routeUser } from "@/server/http";
import { counterQueue } from "@/server/views";

export async function GET() {
  const user = await routeUser("counter:view");
  if (user instanceof NextResponse) return user;
  return fresh({ orders: await counterQueue(user.canteenId) });
}
