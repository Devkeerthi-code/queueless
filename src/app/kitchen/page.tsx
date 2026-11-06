import type { Metadata, Viewport } from "next";
import { AppHeader } from "@/components/app-header";
import { headerCanteen } from "@/components/header-canteen";
import { KitchenBoard } from "@/components/kitchen/kitchen-board";
import { requireRole } from "@/server/auth";
import { kitchenView, menuItemViews } from "@/server/views";

export const metadata: Metadata = { title: "Kitchen" };
export const viewport: Viewport = { themeColor: "#131210" };

export default async function KitchenPage() {
  const user = await requireRole("KITCHEN", "OWNER");
  const now = new Date();
  const [canteen, columns, items] = await Promise.all([headerCanteen(user.canteenId), kitchenView(user.canteenId, now), menuItemViews(user.canteenId, now)]);
  const links = user.role === "OWNER" ? [{ href: "/owner", label: "Dashboard" }, { href: "/counter", label: "Counter" }] : [];

  return (
    <div className="night min-h-dvh">
      <AppHeader canteen={canteen} role={user.role} links={links} />
      <main>
        <h1 className="sr-only">Kitchen orders</h1>
        <KitchenBoard initial={{ columns, at: now.toISOString() }} items={items} />
      </main>
    </div>
  );
}
