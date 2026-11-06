"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { counterQueue, CounterOrder } from "@/server/views";
import { buttonClass } from "../ui/button";
import { cn } from "../ui/cn";
import { EmptyState } from "../ui/empty-state";
import { LiveDot } from "../ui/live-dot";
import { usePoll } from "../use-poll";
import { FoundOrder } from "./found-order";
import { QrScanner } from "./qr-scanner";
import { TokenEntry } from "./token-entry";

type Queue = { orders: Awaited<ReturnType<typeof counterQueue>> };

export function CounterScreen({ initialQueue }: { initialQueue: Queue }) {
  const { data, status, refresh } = usePoll<Queue>("/api/counter/queue", initialQueue);
  const [found, setFound] = useState<CounterOrder | null>(null);
  const [searching, setSearching] = useState(false);

  const lookup = useCallback(async (query: { code?: string; token?: string }) => {
    setSearching(true);
    try {
      const res = await fetch(`/api/counter/lookup?${new URLSearchParams(query)}`, { cache: "no-store" });
      const body = (await res.json()) as CounterOrder | { error: string };
      if (!res.ok || "error" in body) toast.error("error" in body ? body.error : "Lookup failed.");
      else setFound(body);
    } catch {
      toast.error("Couldn't reach the server. Check the connection.");
    } finally {
      setSearching(false);
    }
  }, []);

  const onCode = useCallback((code: string) => lookup({ code }), [lookup]);
  const ready = data.orders.filter((o) => o.status === "READY");
  const waiting = data.orders.filter((o) => o.status !== "READY");

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 pb-16 pt-5 lg:grid-cols-[360px_minmax(0,1fr)_280px]">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="condensed text-4xl font-extrabold tracking-[-0.01em]">Counter</h1>
          <Link href="/counter/walk-in" className={buttonClass("outline", "sm")}>
            Walk-in bill
          </Link>
        </div>
        <QrScanner onCode={onCode} paused={found !== null} />
        <TokenEntry onSubmit={(token) => lookup({ token })} pending={searching} />
      </div>

      <div className="min-w-0">
        {found ? (
          <FoundOrder key={found.id} order={found} onClose={() => setFound(null)} onChanged={refresh} />
        ) : (
          <EmptyState title="Scan a QR or type a token" className="h-full min-h-64 justify-center">
            The order shows up here with what to hand over and how much to collect.
          </EmptyState>
        )}
      </div>

      <aside aria-labelledby="queue-title" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 id="queue-title" className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
            Ready to collect
          </h2>
          <LiveDot status={status} />
        </div>
        {ready.length === 0 ? (
          <p className="rounded-slip border border-dashed border-line px-4 py-6 text-center text-sm text-ink-muted">Nothing ready yet.</p>
        ) : (
          <ul className="grid grid-cols-3 gap-2 lg:grid-cols-2">
            {ready.map((o) => (
              <li key={o.id}>
                <QueueButton token={o.token} payFirst={o.payFirst} ready onClick={() => lookup({ token: o.token })} />
              </li>
            ))}
          </ul>
        )}
        {waiting.length > 0 && (
          <>
            <h2 className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">In the kitchen</h2>
            <ul className="grid grid-cols-4 gap-2 lg:grid-cols-3">
              {waiting.map((o) => (
                <li key={o.id}>
                  <QueueButton token={o.token} payFirst={o.payFirst} onClick={() => lookup({ token: o.token })} />
                </li>
              ))}
            </ul>
          </>
        )}
      </aside>
    </div>
  );
}

function QueueButton({ token, payFirst, ready, onClick }: { token: string; payFirst: boolean; ready?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "press relative w-full rounded-slip border py-2 text-center font-extrabold num condensed",
        ready ? "border-veg bg-veg/10 text-3xl" : "border-line bg-surface text-xl text-ink-muted",
      )}
      aria-label={`Open ${token}${payFirst ? ", pay first" : ""}`}
    >
      {token}
      {payFirst && <span className="absolute right-1 top-1 size-2 rounded-full bg-danger" aria-hidden="true" />}
    </button>
  );
}
