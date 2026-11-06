import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TokenSlip } from "@/components/student/token-slip";
import { requireRole } from "@/server/auth";
import { orderView } from "@/server/views";

export const metadata: Metadata = { title: "Your token" };

export default async function OrderPage({ params }: PageProps<"/orders/[id]">) {
  const user = await requireRole("STUDENT");
  const { id } = await params;
  const order = await orderView(id, { userId: user.id, role: user.role, canteenId: user.canteenId });
  if (!order) notFound();
  return <TokenSlip initial={order} />;
}
