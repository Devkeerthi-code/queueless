import { AppHeader } from "@/components/app-header";
import { headerCanteen } from "@/components/header-canteen";
import { requireRole } from "@/server/auth";

const LINKS = [
  { href: "/menu", label: "Menu" },
  { href: "/orders", label: "Orders" },
];

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("STUDENT");
  return (
    <>
      <AppHeader canteen={await headerCanteen(user.canteenId)} role="STUDENT" links={LINKS} />
      <main>{children}</main>
    </>
  );
}
