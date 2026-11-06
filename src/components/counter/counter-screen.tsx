"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { counterQueue, CounterOrder } from "@/server/views";
import { buttonClass } from "../ui/button";
import { cn } from "../ui/cn";
import { usePoll, type PollStatus } from "../use-poll";
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
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 pb-16 pt-5 lg:grid-cols-[340px_minmax(0,1fr)_300px]">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="condensed text-4xl font-extrabold uppercase">Counter</h1>
          <Link href="/counter/walk-in" className={buttonClass("outline", "sm")}>
            Cash memo
          </Link>
        </div>
        <QrScanner onCode={onCode} paused={found !== null} />
        <div className="lift">
          <TokenEntry onSubmit={(token) => lookup({ token })} pending={searching} />
        </div>
      </div>

      <div className="min-w-0">
        {found ? (
          <FoundOrder key={found.id} order={found} onClose={() => setFound(null)} onChanged={refresh} />
        ) : (
          <div className="grid h-full min-h-64 place-items-center rounded-[6px] border-2 border-dashed border-line p-8 text-center">
            <div>
              <p className="condensed text-3xl font-extrabold uppercase">Ticket slot</p>
              <p className="mt-2 max-w-sm text-ink-muted">Scan a QR or type a token. The ticket lands here with what to hand over and how much to collect.</p>
            </div>
          </div>
        )}
      </div>

      <aside aria-labelledby="queue-title" className="led-board flex flex-col gap-3 self-start p-4">
        <div className="flex items-center justify-between">
          <h2 id="queue-title" className="font-mono text-xs font-semibold tracking-[0.2em]">
            TOKEN NO. · READY
          </h2>
          <BoardStatus status={status} />
        </div>
        {ready.length === 0 ? (
          <p className="py-6 text-center font-mono text-sm text-[#a88a4f]">— nothing ready —</p>
        ) : (
          <ul className="grid grid-cols-3 gap-2">
            {ready.map((o) => (
              <li key={o.id}>
                <BoardButton token={o.token} payFirst={o.payFirst} ready onClick={() => lookup({ token: o.token })} />
              </li>
            ))}
          </ul>
        )}
        {waiting.length > 0 && (
          <>
            <h2 className="mt-2 border-t border-[#2b241d] pt-3 font-mono text-xs font-semibold tracking-[0.2em] text-[#a88a4f]">IN THE KITCHEN</h2>
            <ul className="grid grid-cols-4 gap-1.5">
              {waiting.map((o) => (
                <li key={o.id}>
                  <BoardButton token={o.token} payFirst={o.payFirst} onClick={() => lookup({ token: o.token })} />
                </li>
              ))}
            </ul>
          </>
        )}
      </aside>
    </div>
  );
}

/** Live status in the board's own amber, since it sits on black in both modes. */
function BoardStatus({ status }: { status: PollStatus }) {
  return (
    <span className="flex items-center gap-1.5 font-mono text-[11px] text-[#d9b46a]" role="status">
      <span className={cn("size-2 rounded-full", status === "live" ? "bg-[#4cc46c]" : "animate-pulse bg-[#ff6b5e]")} aria-hidden="true" />
      {status === "live" ? "LIVE" : status === "offline" ? "OFFLINE" : "RECONNECTING"}
    </span>
  );
}

function BoardButton({ token, payFirst, ready, onClick }: { token: string; payFirst: boolean; ready?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "press relative w-full rounded-[3px] border py-1.5 text-center font-mono font-semibold tracking-wider focus-visible:outline-[#f2b33d]",
        ready ? "border-[#4a3a1c] bg-[#1a140c] text-3xl text-[#f2b33d]" : "border-[#2b241d] text-lg text-[#b08f52]",
      )}
      aria-label={`Open ${token}${ready ? ", ready" : ", in the kitchen"}${payFirst ? ", pay first" : ""}`}
    >
      {token}
      {payFirst && <span className="absolute right-1 top-1 size-2 rounded-full bg-[#ff6b5e]" aria-hidden="true" />}
    </button>
  );
}
