import Link from "next/link";
import type { StudentMenuView } from "@/server/views";
import { cn } from "../ui/cn";

const STATUS: Record<string, string> = { PLACED: "Placed", PREPARING: "Being made", READY: "Ready to collect" };

/** Today's tokens, clipped above the rate card so the student never hunts for them. */
export function ActiveOrders({ orders }: { orders: StudentMenuView["activeOrders"] }) {
  if (orders.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2" aria-label="Your tokens today">
      {orders.map((o) => (
        <li key={o.id} className="lift">
          <Link href={`/orders/${o.id}`} className="press paper edge-perf-x flex items-center gap-4 px-5 py-2.5">
            <span className="grid min-w-16 place-items-center rounded-[3px] bg-accent px-2 py-1 text-on-accent">
              <span className="caps text-[9px]">Token</span>
              <span className="condensed text-3xl font-extrabold leading-none">{o.token}</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn("block font-semibold", o.status === "READY" && "text-veg")}>{STATUS[o.status] ?? o.status}</span>
              {o.slotLabel && <span className="font-mono text-sm text-ink-muted">Pickup {o.slotLabel}</span>}
            </span>
            {o.status === "READY" ? (
              <span className="rubber-stamp -rotate-6 text-sm text-veg">Ready</span>
            ) : (
              <span className="text-sm font-semibold text-ink-muted" aria-hidden="true">
                View →
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
