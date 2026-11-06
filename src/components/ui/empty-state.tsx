import type { ReactNode } from "react";
import { cn } from "./cn";

/** A blank slip with a dashed stub: used wherever a list has nothing in it yet. */
export function EmptyState({ title, children, action, className }: { title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("paper flex flex-col items-center gap-3 rounded-slip border-2 border-dashed border-line px-6 py-10 text-center", className)}>
      <svg viewBox="0 0 48 32" className="h-8 w-12 text-ink-muted" aria-hidden="true">
        <path d="M4 4h40v8a4 4 0 0 0 0 8v8H4v-8a4 4 0 0 0 0-8z" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M14 4v24" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 3" />
      </svg>
      <p className="text-lg font-semibold">{title}</p>
      {children && <div className="max-w-sm text-sm text-ink-muted">{children}</div>}
      {action}
    </div>
  );
}
