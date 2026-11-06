import { AppHeader } from "@/components/app-header";
import { headerCanteen } from "@/components/header-canteen";
import { requireRole } from "@/server/auth";

export default async function CounterLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("COUNTER", "OWNER");
  const links = [{ href: "/counter", label: "Counter" }, { href: "/counter/walk-in", label: "Walk-in" }, ...(user.role === "OWNER" ? [{ href: "/owner", label: "Dashboard" }] : [])];
  return (
    <>
      <AppHeader canteen={await headerCanteen(user.canteenId)} role={user.role} links={links} />
      <main>{children}</main>
    </>
  );
}
