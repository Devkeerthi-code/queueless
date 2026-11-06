import Image from "next/image";
import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import type { Role } from "@/lib/permissions";
import { HOME_FOR_ROLE } from "@/lib/permissions";
import { BrandMark } from "./paper/brand-mark";

export type HeaderCanteen = { name: string; isDemo: boolean; logoUrl: string | null };
type NavLink = { href: string; label: string };

const ROLE_LABEL: Record<Role, string> = { STUDENT: "Student", KITCHEN: "Kitchen", COUNTER: "Counter", OWNER: "Owner" };

/** The canteen's signboard over the counter: name, who you are, a few links and log out. */
export function AppHeader({ canteen, role, links = [] }: { canteen: HeaderCanteen; role: Role; links?: NavLink[] }) {
  return (
    <>
      {canteen.isDemo && <DemoRibbon />}
      <header className="no-print sticky top-0 z-30 border-b border-line bg-counter/92 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <Link href={HOME_FOR_ROLE[role]} className="flex min-w-0 items-center gap-2.5 rounded-slip">
            {canteen.logoUrl ? <Image src={canteen.logoUrl} alt="" width={28} height={28} unoptimized className="size-7 rounded-[3px] object-cover" /> : <BrandMark />}
            <span className="condensed truncate text-lg font-extrabold uppercase tracking-wide">{canteen.name}</span>
          </Link>
          <span className="rubber-stamp hidden -rotate-3 text-[10px] text-stamp min-[400px]:inline-block">{ROLE_LABEL[role]}</span>
          <nav aria-label="Main" className="ml-auto flex shrink-0 items-center">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="whitespace-nowrap rounded-slip px-2 py-2 text-sm font-semibold text-ink-muted hover:text-ink sm:px-3">
                {l.label}
              </Link>
            ))}
            <form action={logoutAction}>
              <button type="submit" className="press whitespace-nowrap rounded-slip px-2 py-2 text-sm font-semibold text-ink-muted hover:text-ink sm:px-3">
                Log out
              </button>
            </form>
          </nav>
        </div>
      </header>
    </>
  );
}

/** Yellow-and-black warning tape, so nobody mistakes demo orders for real ones. */
export function DemoRibbon() {
  return (
    <div className="no-print bg-[repeating-linear-gradient(-45deg,#e8a317_0_10px,#1c1a17_10px_20px)] py-1">
      <p className="mx-auto w-fit rounded-[2px] bg-[#1c1a17] px-2 text-center font-mono text-[11px] font-semibold tracking-wide text-[#f2b33d]">
        DEMO DATA<span className="hidden sm:inline"> · sample menu, orders and people</span> · not a real canteen
      </p>
    </div>
  );
}
