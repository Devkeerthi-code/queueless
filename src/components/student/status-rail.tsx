import { formatIstTime } from "@/lib/time";
import type { OrderView } from "@/server/views";
import { cn } from "../ui/cn";

const STEPS = [
  { key: "PLACED", label: "Placed", at: "placedAt" },
  { key: "PREPARING", label: "Being made", at: "preparingAt" },
  { key: "READY", label: "Ready", at: "readyAt" },
  { key: "COLLECTED", label: "Collected", at: "collectedAt" },
] as const;

/** Four stops on a ticket rail. The current stop is filled with the accent. */
export function StatusRail({ status, timeline }: { status: string; timeline: OrderView["timeline"] }) {
  const current = STEPS.findIndex((s) => s.key === status);
  return (
    <ol className="grid grid-cols-4" aria-label="Order progress">
      {STEPS.map((s, i) => {
        const at = timeline[s.at];
        const done = current >= i;
        return (
          <li key={s.key} className="relative flex flex-col items-center text-center" aria-current={i === current ? "step" : undefined}>
            {i > 0 && <span aria-hidden="true" className={cn("absolute right-1/2 top-[7px] h-0.5 w-full transition-colors duration-150", current >= i ? "bg-ink" : "bg-line")} />}
            <span
              aria-hidden="true"
              className={cn(
                "relative z-10 size-4 rounded-full border-2 transition-colors duration-150",
                i === current ? "border-ink bg-accent" : done ? "border-ink bg-ink" : "border-line bg-surface",
              )}
            />
            <span className={cn("mt-2 text-xs font-semibold", done ? "text-ink" : "text-ink-muted")}>{s.label}</span>
            <span className="num text-[11px] text-ink-muted">{at ? formatIstTime(new Date(at)) : " "}</span>
          </li>
        );
      })}
    </ol>
  );
}
