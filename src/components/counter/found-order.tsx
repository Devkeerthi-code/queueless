"use client";

import { useState } from "react";
import { collectOrderAction, takePaymentAction } from "@/app/actions/orders";
import { formatPaise } from "@/lib/money";
import type { CounterOrder } from "@/server/views";
import { Button } from "../ui/button";
import { Stamp } from "../ui/stamp";
import { VegMark } from "../ui/veg-mark";
import { useAction } from "../use-action";
import { PaymentMode, type Mode } from "./payment-mode";
import { PrintLinks } from "./print-links";
import { SlideToConfirm } from "./slide-to-confirm";

type Invoice = { id: string; number: string; totalPaise: number };

const CLOSED: Record<string, { label: string; tone: "ink" | "danger" }> = {
  COLLECTED: { label: "Already collected", tone: "ink" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
  NO_SHOW: { label: "No-show", tone: "danger" },
};

/** The order the counter is dealing with right now: check, take money, hand over, print. */
export function FoundOrder({ order, onClose, onChanged }: { order: CounterOrder; onClose: () => void; onChanged: () => void }) {
  const [mode, setMode] = useState<Mode>("CASH");
  const [current, setCurrent] = useState(order);
  const [handedOver, setHandedOver] = useState<Invoice | null>(null);
  const { run, pending } = useAction();
  const total = current.invoice?.totalPaise ?? current.estimatePaise;
  const closed = CLOSED[current.status];

  function takePayment() {
    run(() => takePaymentAction(current.id, mode), {
      success: (inv) => `Paid ${formatPaise(inv.totalPaise)}. The kitchen can start ${current.token}.`,
      onOk: (inv) => {
        setCurrent({ ...current, paid: true, payFirst: false, invoice: inv });
        onChanged();
      },
    });
  }

  function handOver() {
    run(() => collectOrderAction(current.id, mode), {
      onOk: (inv) => {
        setHandedOver(inv);
        onChanged();
      },
    });
  }

  if (handedOver) {
    return (
      <section aria-live="polite" className="slip flex flex-col items-center gap-4 p-6 text-center">
        <Stamp tone="veg" land className="text-2xl">
          Handed over
        </Stamp>
        <p className="num condensed text-7xl font-extrabold leading-none">{current.token}</p>
        <p className="text-ink-muted">
          Invoice <span className="num font-semibold text-ink">{handedOver.number}</span> · <span className="num font-semibold text-ink">{formatPaise(handedOver.totalPaise)}</span>
        </p>
        <PrintLinks invoiceId={handedOver.id} />
        <Button variant="quiet" onClick={onClose}>
          Next order
        </Button>
      </section>
    );
  }

  return (
    <section aria-labelledby="found-token" className="slip animate-rise overflow-hidden">
      <div className="flex items-start gap-4 border-b border-line p-5">
        <div>
          <p id="found-token" className="num condensed text-7xl font-extrabold leading-none">
            {current.token}
          </p>
          <p className="mt-2 text-ink-muted">
            {current.studentName ?? "Walk-in"}
            {current.slotLabel && <> · pickup {current.slotLabel}</>}
          </p>
        </div>
        <div className="ml-auto flex flex-col items-end gap-2">
          <button type="button" onClick={onClose} className="rounded-slip px-2 py-1 text-sm font-semibold text-ink-muted hover:bg-sunken hover:text-ink">
            Close
          </button>
          {closed ? <Stamp tone={closed.tone}>{closed.label}</Stamp> : <StatusChip status={current.status} />}
        </div>
      </div>

      <ul className="space-y-2 px-5 py-4 text-[17px]">
        {current.lines.map((l, i) => (
          <li key={i} className="flex items-center gap-2">
            <VegMark isVeg={l.isVeg} />
            <span className="num w-8 font-bold">{l.quantity}×</span>
            <span className="min-w-0 flex-1">{l.name}</span>
            <span className="num">{formatPaise(l.totalPaise, { trimWhole: true })}</span>
          </li>
        ))}
      </ul>
      <p className="flex items-baseline justify-between border-t border-dashed border-line px-5 py-3">
        <span className="text-sm text-ink-muted">{current.paid ? "Paid" : current.invoice ? "Billed" : "To collect (final on invoice)"}</span>
        <span className="num text-3xl font-bold">{formatPaise(total)}</span>
      </p>

      {!closed && (
        <div className="flex flex-col gap-4 border-t border-line bg-paper/60 p-5">
          {current.payFirst ? (
            <>
              <p className="rounded-slip bg-danger-soft px-3 py-2 text-sm font-semibold text-danger">Pay first: this student missed recent pickups. Take payment so the kitchen can start.</p>
              <PaymentMode value={mode} onChange={setMode} name="pay-mode" />
              <Button variant="accent" size="lg" pending={pending} onClick={takePayment}>
                Take {formatPaise(total)} by {mode === "CASH" ? "cash" : "UPI"}
              </Button>
            </>
          ) : (
            <>
              {current.status !== "READY" && <p className="rounded-slip bg-warn-soft px-3 py-2 text-sm font-semibold text-warn">The kitchen hasn&apos;t marked this ready yet. Check the tray before handing over.</p>}
              {!current.paid && <PaymentMode value={mode} onChange={setMode} name="collect-mode" />}
              <SlideToConfirm
                label={current.paid ? "Slide to hand over" : `Slide: ${mode === "CASH" ? "cash" : "UPI"} received, hand over`}
                fallbackLabel="Or confirm with a tap"
                onConfirm={handOver}
                pending={pending}
              />
            </>
          )}
        </div>
      )}
      {closed && current.invoice && (
        <div className="border-t border-line p-5">
          <PrintLinks invoiceId={current.invoice.id} />
        </div>
      )}
    </section>
  );
}

function StatusChip({ status }: { status: string }) {
  const label = status === "READY" ? "Ready" : status === "PREPARING" ? "Cooking" : "Placed";
  const tone = status === "READY" ? "bg-veg text-paper" : status === "PREPARING" ? "bg-accent text-on-accent" : "bg-sunken text-ink";
  return <span className={`rounded-[4px] px-2 py-1 text-xs font-bold uppercase tracking-wider ${tone}`}>{label}</span>;
}
