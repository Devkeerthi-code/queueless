import { NextResponse } from "next/server";
import { loadCreditNoteDoc } from "@/server/documents";
import { routeUser } from "@/server/http";
import { renderDocPdf } from "@/server/pdf";

export async function GET(req: Request, ctx: RouteContext<"/api/credit-notes/[id]/pdf">) {
  const user = await routeUser("invoice:view");
  if (user instanceof NextResponse) return user;
  const { id } = await ctx.params;
  const doc = await loadCreditNoteDoc(id, user.canteenId);
  if (!doc) return NextResponse.json({ error: "Credit note not found." }, { status: 404 });
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
