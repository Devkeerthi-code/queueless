"use client";

import { useEffect, useState } from "react";
import { advanceOrderAction } from "@/app/actions/orders";
import { formatIstTime } from "@/lib/time";
import type { KitchenColumn, KitchenOrder, MenuItemView } from "@/server/views";
import { cn } from "../ui/cn";
import { LiveDot } from "../ui/live-dot";
import { useAction } from "../use-action";
import { usePoll } from "../use-poll";
import { KitchenSlip } from "./kitchen-slip";
import { StockPanel } from "./stock-panel";

type Feed = { columns: KitchenColumn[]; at: string };

const RANK: Record<KitchenOrder["status"], number> = { PREPARING: 0, PLACED: 1, READY: 2 };

export function KitchenBoard({ initial, items }: { initial: Feed; items: MenuItemView[] }) {
  const { data, setData, status } = usePoll<Feed>("/api/kitchen", initial);
  const [now, setNow] = useState(() => new Date(initial.at).getTime());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const { run } = useAction();

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const all = data.columns.flatMap((c) => c.orders);
  const toMake = all.filter((o) => o.status !== "READY").length;
  const ready = all.length - toMake;

  function setStatus(orderId: string, next: KitchenOrder["status"]) {
    setData((d) => ({ ...d, columns: d.columns.map((c) => ({ ...c, orders: c.orders.map((o) => (o.id === orderId ? { ...o, status: next } : o)) })) }));
  }

  function advance(order: KitchenOrder) {
    setPendingId(order.id);
    run(() => advanceOrderAction(order.id), {
      onOk: ({ status: next }) => {
        setPendingId(null);
        setStatus(order.id, next);
      },
      onError: () => setPendingId(null),
    });
  }

  return (
    <div className="flex min-h-[calc(100dvh-56px)] flex-col">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line px-4 py-3 sm:px-6">
        <p className="led-board px-3 py-1 font-mono text-4xl font-semibold leading-none" aria-label={`Time now ${formatIstTime(new Date(now))}`}>
          {formatIstTime(new Date(now))}
        </p>
        <p className="text-lg">
          <span className="font-mono font-bold">{toMake}</span> to make · <span className="font-mono font-bold text-veg">{ready}</span> on the spike
        </p>
        <LiveDot status={status} />
        <div className="ml-auto">
          <StockPanel items={items} />
        </div>
      </div>

      {data.columns.length === 0 ? (
        <div className="grid flex-1 place-items-center px-6 text-center">
          <div>
            <div aria-hidden="true" className="mx-auto mb-6 h-2 w-64 rounded-full bg-gradient-to-b from-[#c9ced4] to-[#6c7178]" />
            <p className="condensed text-5xl font-extrabold uppercase text-ink-muted">The rail is empty</p>
            <p className="mt-3 text-lg text-ink-muted">New pre-orders and walk-ins are clipped here within a few seconds, grouped by pickup time.</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 py-4 sm:scroll-px-6 sm:px-6" role="list" aria-label="Orders by pickup slot">
          {data.columns.map((col) => (
            <section key={col.key} role="listitem" aria-label={`Pickup ${col.label}`} className="flex w-[min(86vw,360px)] shrink-0 snap-start flex-col gap-4">
              <ColumnHeader column={col} now={now} />
              <div aria-hidden="true" className="-mb-5 h-2.5 rounded-full bg-gradient-to-b from-[#d7dbe0] via-[#9aa0a6] to-[#5b6066] shadow-[0_2px_3px_rgb(0_0_0/0.5)]" />
              {[...col.orders]
                .sort((a, b) => RANK[a.status] - RANK[b.status])
                .map((o) => (
                  <KitchenSlip key={o.id} order={o} pending={pendingId === o.id} onAdvance={() => advance(o)} />
                ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/** The slot time, and how close it is: neutral, then warning, then late. Colour only, nothing moves. */
function ColumnHeader({ column, now }: { column: KitchenColumn; now: number }) {
  const minutes = column.startsAt ? Math.round((new Date(column.startsAt).getTime() - now) / 60_000) : null;
  const tone = minutes === null ? "text-ink-muted" : minutes < 0 ? "text-danger" : minutes <= 5 ? "text-warn" : "text-ink-muted";
  const due = minutes === null ? "Paid at counter" : minutes < 0 ? `${-minutes} min late` : minutes === 0 ? "Due now" : `in ${minutes} min`;
  const open = column.orders.filter((o) => o.status !== "READY").length;
  return (
    <header className={cn("flex items-baseline gap-3 border-b-4 pb-2 pt-1", minutes !== null && minutes < 0 ? "border-danger" : minutes !== null && minutes <= 5 ? "border-warn" : "border-line")}>
      <h2 className="condensed text-4xl font-extrabold">{column.label}</h2>
      <span className={cn("text-lg font-semibold", tone)}>{due}</span>
      <span className="ml-auto font-mono text-lg text-ink-muted">{open} open</span>
    </header>
  );
}
