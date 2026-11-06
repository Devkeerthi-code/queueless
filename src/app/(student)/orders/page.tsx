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
  PLACED: { label: "Placed", tone: "text-ink" },
  PREPARING: { label: "Being made", tone: "text-accent-ink" },
  READY: { label: "Ready", tone: "text-veg" },
  COLLECTED: { label: "Collected", tone: "text-ink-muted" },
  CANCELLED: { label: "Cancelled", tone: "text-ink-muted" },
  NO_SHOW: { label: "Missed", tone: "text-danger" },
};

export default async function OrdersPage() {
  const user = await requireRole("STUDENT");
  const orders = await studentHistory(user.id);

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-5">
      <h1 className="condensed text-4xl font-extrabold tracking-[-0.01em]">My orders</h1>
      <p className="mt-1 text-sm text-ink-muted">Your last 30 orders. Tokens reset every day.</p>
      {orders.length === 0 ? (
        <EmptyState className="mt-6" title="No orders yet" action={<ButtonLink href="/menu" variant="accent">Order something</ButtonLink>}>
          Your first order becomes your usual, so next time it&apos;s one tap.
        </EmptyState>
      ) : (
        <ul className="slip mt-6 divide-y divide-line">
          {orders.map((o) => {
            const s = STATUS[o.status] ?? { label: o.status, tone: "text-ink" };
            return (
              <li key={o.id}>
                <Link href={`/orders/${o.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-sunken">
                  <span className="num condensed w-14 text-2xl font-extrabold">{o.token}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{o.summary}</span>
                    <span className="num text-sm text-ink-muted">{formatIstDateTime(new Date(o.placedAt))}</span>
                  </span>
                  <span className="text-right">
                    <span className="num block font-semibold">{formatPaise(o.totalPaise, { trimWhole: true })}</span>
                    <span className={cn("text-sm font-semibold", s.tone)}>{s.label}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
