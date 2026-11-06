import { NextResponse } from "next/server";
import { prisma } from "@/server/db";

/** Image ids are unguessable cuids and images never change once stored, so they cache forever. */
export async function GET(_req: Request, ctx: RouteContext<"/api/images/[id]">) {
  const { id } = await ctx.params;
  const image = await prisma.image.findUnique({ where: { id } });
  if (!image) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new Response(Buffer.from(image.data), {
    headers: { "Content-Type": image.mime, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
}
