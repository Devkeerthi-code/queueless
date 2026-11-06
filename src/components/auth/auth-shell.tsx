import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "../paper/brand-mark";

/**
 * A ticket fed from a roll: the form is printed on it. When a form inside sets data-torn,
 * the ticket tears away (pure CSS via :has, so it never blocks input or navigation).
 */
export function AuthShell({ title, subtitle, children, wide = false }: { title: string; subtitle?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <main className={`mx-auto flex min-h-dvh w-full flex-col px-4 py-8 sm:py-12 ${wide ? "max-w-2xl" : "max-w-md"}`}>
      <Link href="/" className="flex items-center gap-2.5 self-start rounded-slip">
        <BrandMark className="size-8" />
        <span className="condensed text-xl font-extrabold uppercase">QueueLess</span>
      </Link>
      <div className="mt-8">
        <div aria-hidden="true" className="relative z-10 h-4 rounded-[4px] bg-gradient-to-b from-[#4a423a] to-[#221d18] shadow-[0_2px_4px_rgb(0_0_0/0.4)]">
          <span className="absolute inset-x-4 bottom-1 h-1 rounded-full bg-black/70" />
        </div>
        <div className="-mt-1.5 overflow-hidden px-2 pb-6">
          <div className="lift animate-print has-[[data-torn]]:animate-tear-away">
            <div className="paper edge-torn-b px-5 pt-6 sm:px-7">
              <h1 className="condensed text-4xl font-extrabold uppercase leading-none sm:text-5xl">{title}</h1>
              {subtitle && <p className="mt-2 text-ink-muted">{subtitle}</p>}
              <hr className="tear-line my-5" />
              <div className="pb-4">{children}</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
