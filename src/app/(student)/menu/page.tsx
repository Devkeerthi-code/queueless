import type { Metadata } from "next";
import { MenuScreen } from "@/components/student/menu-screen";
import { requireRole } from "@/server/auth";
import { studentMenuView } from "@/server/views";

export const metadata: Metadata = { title: "Menu" };

export default async function MenuPage() {
  const user = await requireRole("STUDENT");
  const view = await studentMenuView(user.id, user.canteenId);
  return <MenuScreen initial={view} />;
}
