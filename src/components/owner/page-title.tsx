import type { ReactNode } from "react";
import { cn } from "../ui/cn";

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="condensed text-4xl font-extrabold uppercase tracking-[-0.01em]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

type Edge = "plain" | "torn" | "perf";
const EDGE: Record<Edge, string> = { plain: "rounded-[3px]", torn: "edge-torn-y", perf: "edge-perf" };

/** A printed sheet on the counter: small caps heading, optional torn or perforated edges. */
export function Panel({ title, action, children, className = "", edge = "plain" }: { title: string; action?: ReactNode; children: ReactNode; className?: string; edge?: Edge }) {
  return (
    <section className={cn("lift min-w-0", className)} aria-label={title}>
      <div className={cn("paper flex h-full flex-col px-5", edge === "plain" ? "py-5" : "py-4", EDGE[edge])}>
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-dashed border-line pb-2">
          <h2 className="font-mono text-xs font-semibold tracking-[0.14em] text-ink-muted uppercase">{title}</h2>
          {action}
        </div>
        {children}
      </div>
    </section>
  );
}
