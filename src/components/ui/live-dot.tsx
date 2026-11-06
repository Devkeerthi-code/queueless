import type { PollStatus } from "../use-poll";
import { cn } from "./cn";

const LABEL: Record<PollStatus, string> = { live: "Live", reconnecting: "Reconnecting…", offline: "Offline, showing last update" };

/** A quiet indicator of whether polled data is fresh. */
export function LiveDot({ status, className }: { status: PollStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted", className)} role="status">
      <span className={cn("size-2 rounded-full", status === "live" ? "bg-veg" : status === "offline" ? "bg-danger" : "bg-warn animate-pulse")} aria-hidden="true" />
      {LABEL[status]}
    </span>
  );
}
