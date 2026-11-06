"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cancelOrderAction } from "@/app/actions/orders";
import { formatPaise } from "@/lib/money";
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

        <TokenFace token={data.token} caption={`${data.canteenName} · today's token`}>
          <div className="mt-2 flex min-h-10 items-center justify-center gap-3" aria-live="polite">
            {data.status === "READY" ? (
              <Stamp tone="veg" land key="ready" className="text-xl">
                Ready
              </Stamp>
            ) : data.status === "COLLECTED" ? (
              <Stamp tone="ink">Collected</Stamp>
            ) : data.status === "CANCELLED" ? (
              <Stamp tone="danger">Cancelled</Stamp>
            ) : data.status === "NO_SHOW" ? (
              <Stamp tone="danger">Missed</Stamp>
            ) : (
              <p className="text-center font-semibold">{HEADLINE[data.status]}</p>
            )}
          </div>
          {data.slot && (
            <p className="num mt-1 text-center text-sm text-ink-muted">
              Pickup {data.slot.label} to {data.slot.endsLabel}
            </p>
          )}

          {isActive && (
            <figure className="mx-auto mt-5 w-48">
              <div className="rounded-slip bg-white p-2 [&_svg]:h-auto [&_svg]:w-full" role="img" aria-label={`Pickup QR code for token ${data.token}`} dangerouslySetInnerHTML={{ __html: qrSvg }} />
              <figcaption className="mt-2 text-center text-xs text-ink-muted">Show this at the counter, or say your token.</figcaption>
            </figure>
          )}

          <hr className="tear-line my-5" />
          <ul className="space-y-2 text-[15px]">
            {data.lines.map((l, i) => (
              <li key={i} className="flex items-center gap-2">
                <VegMark isVeg={l.isVeg} />
                <span className="num font-semibold">{l.quantity}×</span>
                <span className="min-w-0 flex-1 truncate">{l.name}</span>
                <span className="num">{formatPaise(l.totalPaise, { trimWhole: true })}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex items-baseline justify-between border-t border-line pt-3">
            <span className="text-sm text-ink-muted">{data.paid ? "Paid" : data.invoice ? "Billed" : "Pay at counter (estimate)"}</span>
            <span className="num text-2xl font-bold">{formatPaise(amount)}</span>
          </p>
        </TokenFace>
      </div>

      <div className="flex flex-col gap-5 lg:pt-10">
        <h1 className="condensed text-4xl font-extrabold tracking-[-0.01em] lg:text-5xl">{HEADLINE[data.status] ?? data.status}</h1>
        {data.status !== "CANCELLED" && data.status !== "NO_SHOW" && <StatusRail status={data.status} timeline={data.timeline} />}
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
