import { NextResponse } from "next/server";
import { fresh, routeUser } from "@/server/http";
import { kitchenView } from "@/server/views";

export async function GET() {
  const user = await routeUser("kitchen:view");
  if (user instanceof NextResponse) return user;
  return fresh({ columns: await kitchenView(user.canteenId), at: new Date().toISOString() });
}
