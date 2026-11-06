import { NextResponse } from "next/server";
import { fresh, routeUser } from "@/server/http";
import { studentMenuView } from "@/server/views";

/** Live stock and slot fill for the student menu. */
export async function GET() {
  const user = await routeUser();
  if (user instanceof NextResponse) return user;
  return fresh(await studentMenuView(user.id, user.canteenId));
}
