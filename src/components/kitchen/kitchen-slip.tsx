"use client";

import { formatIstTime } from "@/lib/time";
import type { KitchenOrder } from "@/server/views";
import { cn } from "../ui/cn";
import { Stamp } from "../ui/stamp";
import { VegMark } from "../ui/veg-mark";

const NEXT_LABEL: Record<KitchenOrder["status"], string> = { PLACED: "Tap to start", PREPARING: "Tap when ready", READY: "On the spike · at counter" };

/**
 * One order ticket hanging from the rail, readable from two metres: 56px token, 26px items.
 * The whole ticket is the tap target. When it's ready it drops onto the spike (a CSS keyframe, never blocks input).
 */
export function KitchenSlip({ order, pending, onAdvance }: { order: KitchenOrder; pending: boolean; onAdvance: () => void }) {
  const blocked = order.payFirst && order.status === "PLACED";
  const done = order.status === "READY";
  const cooking = order.status === "PREPARING";
  return (
    <div className="relative pt-2">
      <span aria-hidden="true" className={cn("absolute left-1/2 top-0 z-10 h-4 w-9 -translate-x-1/2 rounded-[2px] shadow-[0_1px_0_rgb(0_0_0/0.5)]", cooking ? "bg-accent" : "bg-[#9aa0a6]")} />
      <div key={order.status} className={cn("lift", done ? "animate-spike" : cooking && "animate-rise")}>
        <button
          type="button"
          onClick={onAdvance}
          disabled={done || blocked || pending}
          aria-label={`${order.token}: ${order.lines.map((l) => `${l.quantity} ${l.name}`).join(", ")}. ${blocked ? "Pay first" : NEXT_LABEL[order.status]}`}
          className={cn("paper press relative block w-full text-left disabled:cursor-default", done && "opacity-75", pending && "opacity-60")}
        >
          {cooking && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5 bg-accent" />}
          <div className="flex items-end gap-3 border-b border-dashed border-line px-4 pb-2 pt-5">
            <span className="condensed text-[60px] font-extrabold leading-[0.85] tracking-[-0.02em]">{order.token}</span>
            <span className="ml-auto flex flex-col items-end gap-1 pb-1 text-right">
              {!done && <span className={cn("caps text-[12px]", cooking ? "text-accent-ink" : "text-ink-muted")}>{cooking ? "Cooking" : "New"}</span>}
              <span className="font-mono text-xs text-ink-muted">
                {order.source === "WALK_IN" ? "Walk-in · " : ""}
                {formatIstTime(new Date(order.placedAt))}
              </span>
            </span>
          </div>
          <ul className="space-y-1.5 px-4 py-3">
            {order.lines.map((l, i) => (
              <li key={i} className="flex items-center gap-3 text-[26px] font-semibold leading-tight">
                <VegMark isVeg={l.isVeg} className="size-5" />
                <span className="condensed w-12 shrink-0 text-[30px] font-extrabold">{l.quantity}×</span>
                <span className="min-w-0 flex-1">{l.name}</span>
              </li>
            ))}
          </ul>
          <p className={cn("border-t border-dashed border-line px-4 py-2.5 text-[15px] font-semibold", blocked ? "text-danger" : "text-ink-muted")}>
            {blocked ? "Pay at counter before cooking" : NEXT_LABEL[order.status]}
          </p>
          {blocked && (
            <Stamp tone="danger" className="absolute right-3 top-14 text-xl">
              Pay first
            </Stamp>
          )}
          {done && (
            <Stamp tone="veg" className="absolute bottom-12 right-3 text-xl">
              Ready
            </Stamp>
          )}
        </button>
      </div>
    </div>
  );
}
