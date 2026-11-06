import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { prisma } from "@/server/db";
import { sweepNoShows } from "@/server/noshows";

function authorised(req: Request): boolean {
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env().CRON_SECRET}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Daily cleanup (Vercel Cron sends the CRON_SECRET bearer token). Status is also computed on every read, so this only makes it permanent. */
export async function GET(req: Request) {
  if (!authorised(req)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const now = new Date();
  const canteens = await prisma.canteen.findMany({ select: { id: true } });
  const results = [];
  for (const c of canteens) results.push({ canteenId: c.id, ...(await sweepNoShows(c.id, now)) });
  // Expired sessions are dead weight; clear them on the same schedule.
  const sessions = await prisma.session.deleteMany({ where: { expiresAt: { lt: now } } });
  return NextResponse.json({ ok: true, results, expiredSessions: sessions.count });
}
