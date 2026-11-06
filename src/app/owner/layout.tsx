import { AppHeader } from "@/components/app-header";
import { headerCanteen } from "@/components/header-canteen";
import { OwnerNav } from "@/components/owner/owner-nav";
import { requireRole } from "@/server/auth";

const STAFF_LINKS = [
  { href: "/kitchen", label: "Kitchen" },
  { href: "/counter", label: "Counter" },
];

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("OWNER");
  return (
    <>
      <AppHeader canteen={await headerCanteen(user.canteenId)} role="OWNER" links={STAFF_LINKS} />
      <div className="mx-auto flex max-w-7xl">
        <OwnerNav />
        <main className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-6 lg:pb-12">{children}</main>
      </div>
    </>
  );
}
