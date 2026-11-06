import { formatIstTime } from "@/lib/time";
import type { OrderView } from "@/server/views";
import { cn } from "../ui/cn";

const STEPS = [
  { key: "PLACED", label: "Placed", at: "placedAt" },
  { key: "PREPARING", label: "Being made", at: "preparingAt" },
  { key: "READY", label: "Ready", at: "readyAt" },
  { key: "COLLECTED", label: "Collected", at: "collectedAt" },
] as const;

/** A punch strip: each stop the order has passed is punched through, the current one is ringed in turmeric. */
export function StatusRail({ status, timeline }: { status: string; timeline: OrderView["timeline"] }) {
  const current = STEPS.findIndex((s) => s.key === status);
  return (
    <ol className="grid grid-cols-4" aria-label="Order progress">
      {STEPS.map((s, i) => {
        const at = timeline[s.at];
        const done = current >= i;
        return (
          <li key={s.key} className="relative flex flex-col items-center text-center" aria-current={i === current ? "step" : undefined}>
            {i > 0 && <span aria-hidden="true" className={cn("absolute right-1/2 top-[9px] w-full border-t-2", current >= i ? "border-ink" : "border-dashed border-line")} />}
            <span aria-hidden="true" className={cn("relative z-10 grid size-5 place-items-center rounded-full", i === current ? "bg-accent ring-2 ring-ink" : done ? "bg-ink" : "border-2 border-line bg-paper")}>
              {done && <span key={status} className={cn("size-2.5 rounded-full bg-counter shadow-[inset_0_1px_2px_rgb(0_0_0/0.6)]", i === current && "animate-punch")} />}
            </span>
            <span className={cn("mt-2 text-xs font-semibold", done ? "text-ink" : "text-ink-muted")}>{s.label}</span>
            <span className="font-mono text-[11px] text-ink-muted">{at ? formatIstTime(new Date(at)) : " "}</span>
          </li>
        );
      })}
    </ol>
  );
}
