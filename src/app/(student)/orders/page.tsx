import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPaise } from "@/lib/money";
import { formatIstDateTime } from "@/lib/time";
import { requireRole } from "@/server/auth";
import { studentHistory } from "@/server/views";

export const metadata: Metadata = { title: "My orders" };

const STATUS: Record<string, { label: string; tone: string }> = {
  PLACED: { label: "Placed", tone: "text-stamp" },
  PREPARING: { label: "Cooking", tone: "text-stamp" },
  READY: { label: "Ready", tone: "text-veg" },
  COLLECTED: { label: "Collected", tone: "text-stamp" },
  CANCELLED: { label: "Cancelled", tone: "text-danger" },
  NO_SHOW: { label: "Missed", tone: "text-danger" },
};

const TILT = ["-rotate-[0.8deg]", "rotate-[0.6deg]", "-rotate-[0.3deg]", "rotate-[1deg]"];

/** Old tickets impaled on the bill spike, newest on top. */
export default async function OrdersPage() {
  const user = await requireRole("STUDENT");
  const orders = await studentHistory(user.id);

  return (
    <div className="mx-auto max-w-xl px-4 pb-16 pt-5">
      <h1 className="condensed text-4xl font-extrabold uppercase">On the spike</h1>
      <p className="mt-1 text-sm text-ink-muted">Your last 30 tickets. Tokens restart from A1 every morning.</p>
      {orders.length === 0 ? (
        <EmptyState className="mt-6" title="The spike is empty" action={<ButtonLink href="/menu" variant="accent">Order something</ButtonLink>}>
          Your first order becomes your usual, so next time it&apos;s one tap.
        </EmptyState>
      ) : (
        <div className="relative mt-8 pl-2">
          <span aria-hidden="true" className="absolute bottom-0 left-1/2 top-[-14px] w-1 -translate-x-1/2 rounded-t-full bg-gradient-to-r from-[#8a8f96] via-[#e3e6ea] to-[#6c7178] shadow-[0_0_0_1px_rgb(0_0_0/0.2)]" />
          <ul className="relative flex flex-col gap-3">
            {orders.map((o, i) => {
              const s = STATUS[o.status] ?? { label: o.status, tone: "text-ink" };
              return (
                <li key={o.id} className={cn("lift", TILT[i % TILT.length])}>
                  <Link href={`/orders/${o.id}`} className="paper punched flex items-center gap-4 px-4 pb-3 pt-7 hover:brightness-[.98]">
                    <span className="grid min-w-14 place-items-center rounded-[3px] bg-accent px-2 py-1 text-on-accent">
                      <span className="condensed text-2xl font-extrabold leading-none">{o.token}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{o.summary}</span>
                      <span className="font-mono text-xs text-ink-muted">{formatIstDateTime(new Date(o.placedAt))}</span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <span className="font-mono font-semibold">{formatPaise(o.totalPaise, { trimWhole: true })}</span>
                      <span className={cn("rubber-stamp -rotate-6 text-[10px]", s.tone)}>{s.label}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
