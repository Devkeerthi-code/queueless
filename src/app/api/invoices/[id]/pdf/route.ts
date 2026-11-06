import { NextResponse } from "next/server";
import { loadInvoiceDoc } from "@/server/documents";
import { routeUser } from "@/server/http";
import { renderDocPdf } from "@/server/pdf";
import { prisma } from "@/server/db";

export async function GET(req: Request, ctx: RouteContext<"/api/invoices/[id]/pdf">) {
  const user = await routeUser();
  if (user instanceof NextResponse) return user;
  const { id } = await ctx.params;

  // Staff can print any invoice; a student only the one for their own order.
  if (user.role === "STUDENT") {
    const own = await prisma.invoice.findFirst({ where: { id, order: { userId: user.id } }, select: { id: true } });
    if (!own) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  } else if (user.role === "KITCHEN") {
    return NextResponse.json({ error: "Not allowed for your role." }, { status: 403 });
  }

  const doc = await loadInvoiceDoc(id, user.canteenId);
  if (!doc) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  const layout = new URL(req.url).searchParams.get("layout") === "thermal" ? "thermal" : "a4";
  const pdf = await renderDocPdf(doc, layout);
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${doc.number.replace(/\//g, "-")}-${layout}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
