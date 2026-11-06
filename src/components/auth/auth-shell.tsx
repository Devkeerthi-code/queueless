import Link from "next/link";
import type { ReactNode } from "react";

/** A narrow paper column with the brand at the top, used by login, signup and setup. */
export function AuthShell({ title, subtitle, children, wide = false }: { title: string; subtitle?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <main className={`mx-auto flex min-h-dvh w-full flex-col px-4 py-8 sm:py-14 ${wide ? "max-w-2xl" : "max-w-md"}`}>
      <Link href="/" className="flex items-center gap-2.5 self-start rounded-slip">
        <span aria-hidden="true" className="grid size-8 place-items-center rounded-[5px] bg-accent font-extrabold text-on-accent condensed">
          Q
        </span>
        <span className="font-semibold tracking-tight">QueueLess</span>
      </Link>
      <h1 className="condensed mt-10 text-4xl font-extrabold tracking-[-0.01em] sm:text-5xl">{title}</h1>
      {subtitle && <p className="mt-3 text-ink-muted">{subtitle}</p>}
      <div className="mt-8">{children}</div>
    </main>
  );
}
