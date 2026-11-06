import Image from "next/image";
import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import type { Role } from "@/lib/permissions";
import { HOME_FOR_ROLE } from "@/lib/permissions";
import { cn } from "./ui/cn";

export type HeaderCanteen = { name: string; isDemo: boolean; logoUrl: string | null };
type NavLink = { href: string; label: string };

const ROLE_LABEL: Record<Role, string> = { STUDENT: "Student", KITCHEN: "Kitchen", COUNTER: "Counter", OWNER: "Owner" };

/** Canteen name, role badge, a few links and log out. Same on every signed-in surface. */
export function AppHeader({ canteen, role, links = [], tone = "paper" }: { canteen: HeaderCanteen; role: Role; links?: NavLink[]; tone?: "paper" | "dark" }) {
  return (
    <>
      {canteen.isDemo && <DemoRibbon />}
      <header className={cn("no-print sticky top-0 z-30 border-b border-line backdrop-blur-sm", tone === "dark" ? "bg-paper" : "bg-paper/90")}>
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <Link href={HOME_FOR_ROLE[role]} className="flex min-w-0 items-center gap-2.5 rounded-slip">
            {canteen.logoUrl ? (
              <Image src={canteen.logoUrl} alt="" width={28} height={28} unoptimized className="size-7 rounded-[4px] object-cover" />
            ) : (
              <span aria-hidden="true" className="grid size-7 place-items-center rounded-[4px] bg-accent text-[13px] font-extrabold text-on-accent condensed">
                Q
              </span>
            )}
            <span className="truncate font-semibold tracking-tight">{canteen.name}</span>
          </Link>
          <span className="hidden rounded-[4px] border min-[400px]:inline border-line px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{ROLE_LABEL[role]}</span>
          <nav aria-label="Main" className="ml-auto flex shrink-0 items-center">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="whitespace-nowrap rounded-slip px-2 py-2 text-sm font-medium text-ink-muted hover:bg-sunken hover:text-ink sm:px-3">
                {l.label}
              </Link>
            ))}
            <form action={logoutAction}>
              <button type="submit" className="press whitespace-nowrap rounded-slip px-2 py-2 sm:px-3 text-sm font-medium text-ink-muted hover:bg-sunken hover:text-ink">
                Log out
              </button>
            </form>
          </nav>
        </div>
      </header>
    </>
  );
}

export function DemoRibbon() {
  return (
    <div className="no-print hatched border-b border-line bg-warn-soft px-4 py-1 text-center text-xs font-semibold tracking-wide text-warn">
      DEMO DATA<span className="hidden sm:inline"> · sample menu, orders and people</span> · not a real canteen
    </div>
  );
}
