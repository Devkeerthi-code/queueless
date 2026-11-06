import Link from "next/link";
import type { StudentMenuView } from "@/server/views";
import { cn } from "../ui/cn";

const STATUS: Record<string, string> = { PLACED: "Placed", PREPARING: "Being made", READY: "Ready to collect" };

/** Today's open tokens sit above the menu, so the student never hunts for them. */
export function ActiveOrders({ orders }: { orders: StudentMenuView["activeOrders"] }) {
  if (orders.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2" aria-label="Your orders today">
      {orders.map((o) => (
        <li key={o.id}>
          <Link
            href={`/orders/${o.id}`}
            className={cn("press flex items-center gap-4 rounded-slip border px-4 py-3", o.status === "READY" ? "border-veg bg-veg/10" : "border-line bg-surface")}
          >
            <span className="num condensed text-3xl font-extrabold leading-none">{o.token}</span>
            <span className="flex-1">
              <span className={cn("block font-semibold", o.status === "READY" && "text-veg")}>{STATUS[o.status] ?? o.status}</span>
              {o.slotLabel && <span className="text-sm text-ink-muted">Pickup {o.slotLabel}</span>}
            </span>
            <span className="text-sm font-semibold text-ink-muted" aria-hidden="true">
              View →
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
