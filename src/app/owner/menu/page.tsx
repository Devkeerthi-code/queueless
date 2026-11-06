import type { Metadata } from "next";
import { OwnerMenu } from "@/components/owner/owner-menu";
import { requireRole } from "@/server/auth";
import { ownerMenu } from "@/server/owner-views";

export const metadata: Metadata = { title: "Menu" };

export default async function OwnerMenuPage() {
  const user = await requireRole("OWNER");
  return <OwnerMenu items={await ownerMenu(user.canteenId)} />;
}
