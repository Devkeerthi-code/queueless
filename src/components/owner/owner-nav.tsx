"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../ui/cn";

const ITEMS = [
  { href: "/owner", label: "Today", icon: "M3 13.5V8M8 13.5V2.5M13 13.5V6" },
  { href: "/owner/menu", label: "Menu", icon: "M3 4h10M3 8h10M3 12h6" },
  { href: "/owner/invoices", label: "Bills", icon: "M4 2h8v12l-2-1.2L8 14l-2-1.2L4 14zM6 6h4M6 9h4" },
  { href: "/owner/staff", label: "Staff", icon: "M8 7a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM3 14c.6-2.8 2.6-4.2 5-4.2s4.4 1.4 5 4.2" },
  { href: "/owner/settings", label: "Settings", icon: "M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" },
] as const;

const isActive = (path: string, href: string) => (href === "/owner" ? path === "/owner" : path.startsWith(href));

/** A left rail on laptops, a bottom tab bar on phones. Same five places. */
export function OwnerNav() {
  const path = usePathname();
  return (
    <>
      <nav aria-label="Owner" className="no-print sticky top-14 hidden h-[calc(100dvh-56px)] w-52 shrink-0 flex-col gap-1 border-r border-line px-3 py-5 lg:flex">
        {ITEMS.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            aria-current={isActive(path, i.href) ? "page" : undefined}
            className={cn("flex h-10 items-center gap-3 rounded-slip px-3 text-[15px] font-medium", isActive(path, i.href) ? "bg-ink text-paper" : "text-ink-muted hover:bg-sunken hover:text-ink")}
          >
            <NavIcon d={i.icon} />
            {i.label}
          </Link>
        ))}
        <div className="mt-auto flex flex-col gap-1 border-t border-line pt-3">
          <p className="px-3 text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Open as staff</p>
          <Link href="/kitchen" className="rounded-slip px-3 py-2 text-[15px] text-ink-muted hover:bg-sunken hover:text-ink">
            Kitchen board
          </Link>
          <Link href="/counter" className="rounded-slip px-3 py-2 text-[15px] text-ink-muted hover:bg-sunken hover:text-ink">
            Counter
          </Link>
        </div>
      </nav>
      <nav aria-label="Owner" className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm lg:hidden">
        {ITEMS.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            aria-current={isActive(path, i.href) ? "page" : undefined}
            className={cn("flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold", isActive(path, i.href) ? "text-ink" : "text-ink-muted")}
          >
            <span className={cn("grid h-7 w-12 place-items-center rounded-full transition-colors duration-150", isActive(path, i.href) && "bg-accent text-on-accent")}>
              <NavIcon d={i.icon} />
            </span>
            {i.label}
          </Link>
        ))}
      </nav>
    </>
  );
}

function NavIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
