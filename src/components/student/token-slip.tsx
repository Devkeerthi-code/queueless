"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cancelOrderAction } from "@/app/actions/orders";
import { formatPaise } from "@/lib/money";
import { formatIstTime } from "@/lib/time";
import type { OrderView } from "@/server/views";
import { TokenFace } from "../token-face";
import { Button, buttonClass } from "../ui/button";
import { cn } from "../ui/cn";
import { LiveDot } from "../ui/live-dot";
import { Stamp } from "../ui/stamp";
import { VegMark } from "../ui/veg-mark";
import { useAction } from "../use-action";
import { usePoll } from "../use-poll";
import { NotifyButton } from "./notify-button";
import { StatusRail } from "./status-rail";

type StatusPayload = Omit<OrderView, "qrSvg">;

const HEADLINE: Record<string, string> = {
  PLACED: "Order placed",
  PREPARING: "Being made now",
  READY: "Ready. Go to the counter",
  COLLECTED: "Collected. Enjoy",
  CANCELLED: "Cancelled",
  NO_SHOW: "Not collected in time",
};

const ACTIVE = new Set(["PLACED", "PREPARING", "READY"]);

export function TokenSlip({ initial }: { initial: OrderView }) {
  const { qrSvg, ...initialStatus } = initial;
  const active = ACTIVE.has(initialStatus.status);
  const { data, status: live, refresh } = usePoll<StatusPayload>(active ? `/api/orders/${initial.id}` : null, initialStatus);
  const isActive = ACTIVE.has(data.status);
  const amount = data.invoice?.totalPaise ?? data.estimatePaise;
  const payFirst = data.requiresPrepay && !data.paid && isActive;
  useReadyBuzz(data.status);

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 pb-16 pt-5 lg:grid-cols-[400px_minmax(0,1fr)] lg:gap-12">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Link href="/menu" className="rounded-slip py-1 text-sm font-semibold text-ink-muted hover:text-ink">
            ← Menu
          </Link>
          {isActive && <LiveDot status={live} />}
        </div>

        <TokenFace token={data.token} caption={`${data.canteenName} · token no.`}>
          <div className="mt-2 flex min-h-10 items-center justify-center gap-3" aria-live="polite">
            {data.status === "READY" ? (
              <Stamp tone="veg" land key="ready" className="text-xl">
                Ready
              </Stamp>
            ) : data.status === "COLLECTED" ? (
              <Stamp tone="violet">Collected</Stamp>
            ) : data.status === "CANCELLED" ? (
              <Stamp tone="danger">Cancelled</Stamp>
            ) : data.status === "NO_SHOW" ? (
              <Stamp tone="danger">Missed</Stamp>
            ) : (
              <p className="caps text-center text-ink-muted">{HEADLINE[data.status]}</p>
            )}
          </div>
          {data.slot && (
            <p className="mt-1 text-center font-mono text-sm">
              PICKUP {data.slot.label} – {data.slot.endsLabel}
            </p>
          )}

          {isActive && (
            <figure className="mx-auto mt-5 w-48">
              <div className="rounded-[2px] bg-white p-2 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)] [&_svg]:h-auto [&_svg]:w-full" role="img" aria-label={`Pickup QR code for token ${data.token}`} dangerouslySetInnerHTML={{ __html: qrSvg }} />
              <figcaption className="mt-2 text-center text-xs text-ink-muted">Show this at the counter, or say your token.</figcaption>
            </figure>
          )}

          <hr className="tear-line my-5" />
          <ul className="space-y-1.5 font-mono text-[14px]">
            {data.lines.map((l, i) => (
              <li key={i} className="flex items-center gap-2">
                <VegMark isVeg={l.isVeg} className="size-3.5" />
                <span>{l.quantity}×</span>
                <span className="min-w-0 flex-1 truncate">{l.name}</span>
                <span>{formatPaise(l.totalPaise, { trimWhole: true })}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex items-baseline justify-between border-t border-dashed border-line pt-3 font-mono">
            <span className="text-sm font-semibold">{data.paid ? "PAID" : data.invoice ? "BILLED" : isActive ? "PAY AT COUNTER" : "NOT BILLED"}</span>
            <span className="text-2xl font-bold">{formatPaise(amount)}</span>
          </p>
          <p className="mt-1 pb-1 text-right font-mono text-[11px] text-ink-muted">PLACED {formatIstTime(new Date(data.placedAt))}</p>
        </TokenFace>
      </div>

      <div className="flex flex-col gap-5 lg:pt-10">
        <h1 className="condensed text-4xl font-extrabold tracking-[-0.01em] lg:text-5xl">{HEADLINE[data.status] ?? data.status}</h1>
        {data.status !== "CANCELLED" && data.status !== "NO_SHOW" && (
          <div className="lift">
            <div className="paper edge-perf-x px-6 py-4">
              <StatusRail status={data.status} timeline={data.timeline} />
            </div>
          </div>
        )}
        {payFirst && <PayFirstNotice amount={amount} upiLink={data.upiLink} />}
        {isActive && !payFirst && data.upiLink && !data.paid && (
          <a href={data.upiLink} className={buttonClass("outline", "lg", "w-full")}>
            Pay {formatPaise(amount)} by UPI now
          </a>
        )}
        {isActive && data.status !== "READY" && <NotifyButton />}
        {data.status === "NO_SHOW" && (
          <p className="text-ink-muted">This order wasn&apos;t collected within the grace time after its slot. Repeated misses mean paying before the kitchen starts next time.</p>
        )}
        {data.invoice && (
          <div className="flex flex-wrap gap-2">
            <a href={`/api/invoices/${data.invoice.id}/pdf?layout=a4`} target="_blank" rel="noopener" className={buttonClass("outline")}>
              Invoice {data.invoice.number} (PDF)
            </a>
          </div>
        )}
        {data.canCancel && <CancelOrder orderId={data.id} onDone={refresh} />}
        <Link href="/orders" className="text-sm font-semibold text-ink-muted underline-offset-4 hover:text-ink hover:underline">
          All my orders
        </Link>
      </div>
    </div>
  );
}

function PayFirstNotice({ amount, upiLink }: { amount: number; upiLink: string | null }) {
  return (
    <div className="rounded-slip border border-warn/50 bg-warn-soft p-4">
      <p className="font-semibold text-warn">Pay first, then the kitchen starts</p>
      <p className="mt-1 text-sm">
        A few recent orders weren&apos;t collected, so this one needs payment before cooking. Pay {formatPaise(amount)} at the counter{upiLink ? " or by UPI and show the counter your payment screen" : ""}.
      </p>
      {upiLink && (
        <a href={upiLink} className={cn(buttonClass("ink", "md"), "mt-3")}>
          Pay by UPI
        </a>
      )}
    </div>
  );
}

/** Two taps to cancel, so a stray thumb doesn't lose your slot. */
function CancelOrder({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const { run, pending } = useAction();
  const [armed, setArmed] = useState(false);
  return (
    <div className="flex items-center gap-3">
      <Button
        variant="danger"
        pending={pending}
        onClick={() => {
          if (!armed) return setArmed(true);
          run(() => cancelOrderAction(orderId), { success: "Order cancelled. Your slot is free for someone else.", onOk: onDone });
        }}
      >
        {armed ? "Tap again to cancel" : "Cancel order"}
      </Button>
      {armed && !pending && (
        <button type="button" className="text-sm font-semibold text-ink-muted hover:text-ink" onClick={() => setArmed(false)}>
          Keep it
        </button>
      )}
    </div>
  );
}

/** A short buzz on phones the moment the order flips to Ready while this page is open. */
function useReadyBuzz(status: string) {
  const previous = useRef(status);
  useEffect(() => {
    if (status === "READY" && previous.current !== "READY" && "vibrate" in navigator) navigator.vibrate([60, 40, 60]);
    previous.current = status;
  }, [status]);
}
