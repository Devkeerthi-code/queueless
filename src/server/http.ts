import "server-only";
import { NextResponse } from "next/server";
import { can, type Action } from "@/lib/permissions";
import { getCurrentUser, type CurrentUser } from "./auth";

/** For route handlers: the user if signed in and allowed, otherwise a ready-made 401/403 response. */
export async function routeUser(action?: Action): Promise<CurrentUser | NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Log in again." }, { status: 401 });
  if (action && !can(user.role, action)) return NextResponse.json({ error: "Not allowed for your role." }, { status: 403 });
  return user;
}

/** Polling responses must never be cached by the browser or a CDN. */
export function fresh<T>(data: T): NextResponse {
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
