import type { Metadata } from "next";
import { WalkInScreen } from "@/components/counter/walk-in-screen";
import { requireRole } from "@/server/auth";
import { menuItemViews } from "@/server/views";

export const metadata: Metadata = { title: "Walk-in bill" };

export default async function WalkInPage() {
  const user = await requireRole("COUNTER", "OWNER");
  return <WalkInScreen items={await menuItemViews(user.canteenId, new Date())} />;
}
