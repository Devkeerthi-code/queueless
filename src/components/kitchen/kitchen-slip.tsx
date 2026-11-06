"use client";

import type { KitchenOrder } from "@/server/views";
import { cn } from "../ui/cn";
import { Stamp } from "../ui/stamp";
import { VegMark } from "../ui/veg-mark";

const NEXT_LABEL: Record<KitchenOrder["status"], string> = { PLACED: "Tap to start", PREPARING: "Tap when ready", READY: "Waiting at counter" };

/** One order, readable from two metres: huge token, big item lines, whole slip is the tap target. */
export function KitchenSlip({ order, pending, onAdvance }: { order: KitchenOrder; pending: boolean; onAdvance: () => void }) {
  const blocked = order.payFirst && order.status === "PLACED";
  const done = order.status === "READY";
  return (
    <button
      type="button"
      onClick={onAdvance}
      disabled={done || blocked || pending}
      aria-label={`${order.token}: ${order.lines.map((l) => `${l.quantity} ${l.name}`).join(", ")}. ${blocked ? "Pay first" : NEXT_LABEL[order.status]}`}
      className={cn(
        "press relative w-full overflow-hidden rounded-slip border-2 text-left transition-colors duration-150 disabled:cursor-default",
        order.status === "PLACED" && "border-line bg-surface hover:border-ink/50",
        order.status === "PREPARING" && "border-accent bg-accent/10",
        done && "border-line bg-sunken opacity-70",
        pending && "opacity-60",
      )}
    >
      <div className="flex items-center gap-3 border-b border-line px-4 pb-2 pt-3">
        <span className="num condensed text-[56px] font-extrabold leading-none tracking-[-0.02em]">{order.token}</span>
        <span className="ml-auto flex flex-col items-end gap-1 text-right">
          <span className={cn("text-sm font-bold uppercase tracking-wider", order.status === "PREPARING" ? "text-accent-ink" : done ? "text-veg" : "text-ink-muted")}>
            {order.status === "PLACED" ? "New" : order.status === "PREPARING" ? "Cooking" : "Ready"}
          </span>
          {order.source === "WALK_IN" && <span className="text-xs font-semibold text-ink-muted">Walk-in</span>}
        </span>
      </div>
      <ul className="space-y-1.5 px-4 py-3">
        {order.lines.map((l, i) => (
          <li key={i} className="flex items-center gap-3 text-[26px] font-semibold leading-tight">
            <VegMark isVeg={l.isVeg} className="size-5" />
            <span className="num w-10 shrink-0 font-extrabold">{l.quantity}×</span>
            <span className="min-w-0 flex-1">{l.name}</span>
          </li>
        ))}
      </ul>
      <p className={cn("px-4 pb-3 text-sm font-semibold", blocked ? "text-danger" : "text-ink-muted")}>{blocked ? "Pay at counter before cooking" : NEXT_LABEL[order.status]}</p>
      {blocked && (
        <Stamp tone="danger" className="absolute right-3 top-16 bg-surface/80 text-lg">
          Pay first
        </Stamp>
      )}
    </button>
  );
}
