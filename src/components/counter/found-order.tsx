"use client";

import { useState } from "react";
import { collectOrderAction, takePaymentAction } from "@/app/actions/orders";
import { formatPaise } from "@/lib/money";
import type { CounterOrder } from "@/server/views";
import { TearButton } from "../paper/tear-button";
import { Button, Spinner } from "../ui/button";
import { cn } from "../ui/cn";
import { Stamp } from "../ui/stamp";
import { VegMark } from "../ui/veg-mark";
import { useAction } from "../use-action";
import { PaymentMode, type Mode } from "./payment-mode";
import { PrintLinks } from "./print-links";

type Invoice = { id: string; number: string; totalPaise: number };

const CLOSED: Record<string, { label: string; tone: "violet" | "danger" }> = {
  COLLECTED: { label: "Already collected", tone: "violet" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
  NO_SHOW: { label: "No-show", tone: "danger" },
};

/**
 * The ticket the counter is holding. Finding it punches a hole through it; handing over tears it along
 * the perforation (one tap, or drag the strip), the student's half flies off and the counterfoil stays.
 */
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
    if (pending) return;
    run(() => collectOrderAction(current.id, mode), {
      onOk: (inv) => {
        setHandedOver(inv);
        onChanged();
      },
    });
  }

  if (handedOver) return <Collected token={current.token} invoice={handedOver} onNext={onClose} />;

  return (
    <section aria-labelledby="found-token" className="lift animate-rise">
      <div className="paper relative">
        <span aria-hidden="true" className="absolute left-1/2 top-3 size-4 -translate-x-1/2 animate-punch rounded-full bg-counter shadow-[inset_0_1px_3px_rgb(0_0_0/0.6)]" />
        <div className="flex items-start gap-4 border-b border-dashed border-line px-5 pb-4 pt-8">
          <div className="rounded-[3px] bg-accent px-3 py-1.5 text-on-accent">
            <p className="caps text-[10px]">Token no.</p>
            <p id="found-token" className="condensed text-7xl font-extrabold leading-none">
              {current.token}
            </p>
          </div>
          <div className="min-w-0 pt-1">
            <p className="truncate text-lg font-semibold">{current.studentName ?? "Walk-in"}</p>
            {current.slotLabel && <p className="font-mono text-sm text-ink-muted">PICKUP {current.slotLabel}</p>}
            <div className="mt-2">{closed ? <Stamp tone={closed.tone}>{closed.label}</Stamp> : <StatusStamp status={current.status} />}</div>
          </div>
          <button type="button" onClick={onClose} className="ml-auto rounded-slip px-2 py-1 text-sm font-semibold text-ink-muted hover:bg-sunken hover:text-ink">
            Close
          </button>
        </div>

        <ul className="space-y-1.5 px-5 py-4 font-mono text-[15px]">
          {current.lines.map((l, i) => (
            <li key={i} className="flex items-center gap-2">
              <VegMark isVeg={l.isVeg} className="size-3.5" />
              <span className="w-8 font-bold">{l.quantity}×</span>
              <span className="min-w-0 flex-1">{l.name}</span>
              <span>{formatPaise(l.totalPaise, { trimWhole: true })}</span>
            </li>
          ))}
        </ul>
        <p className="flex items-baseline justify-between border-t border-dashed border-line px-5 py-3 font-mono">
          <span className="text-sm font-semibold">{current.paid ? "PAID" : current.invoice ? "BILLED" : "TO COLLECT"}</span>
          <span className="text-3xl font-bold">{formatPaise(total)}</span>
        </p>

        {!closed && (current.payFirst || current.status !== "READY" || !current.paid) && (
          <div className="flex flex-col gap-4 border-t border-line px-5 pb-5 pt-4">
            {current.payFirst ? (
              <>
                <p className="rounded-[3px] bg-danger-soft px-3 py-2 text-sm font-semibold text-danger">Pay first: this student missed recent pickups. Take payment so the kitchen can start.</p>
                <PaymentMode value={mode} onChange={setMode} name="pay-mode" />
                <Button variant="accent" size="lg" pending={pending} onClick={takePayment}>
                  Take {formatPaise(total)} by {mode === "CASH" ? "cash" : "UPI"}
                </Button>
              </>
            ) : (
              <>
                {current.status !== "READY" && <p className="rounded-[3px] bg-warn-soft px-3 py-2 text-sm font-semibold text-warn">The kitchen hasn&apos;t marked this ready yet. Check the tray before handing over.</p>}
                {!current.paid && <PaymentMode value={mode} onChange={setMode} name="collect-mode" />}
              </>
            )}
          </div>
        )}
        {closed && current.invoice && (
          <div className="border-t border-line p-5">
            <PrintLinks invoiceId={current.invoice.id} />
          </div>
        )}
      </div>
      {!closed && !current.payFirst && (
        <div className="paper">
          <div className="perf-h" aria-hidden="true" />
          <TearButton
            onTear={handOver}
            disabled={pending}
            tug={false}
            label={current.paid ? `Hand over ${current.token}` : `${mode === "CASH" ? "Cash" : "UPI"} received, hand over ${current.token}`}
            className="h-16 w-full bg-ink font-semibold text-on-ink hover:bg-ink/90"
          >
            <span className="flex items-center gap-3">
              {pending ? <Spinner /> : <ScissorIcon />}
              <span>{current.paid ? "Hand over" : `${mode === "CASH" ? "Cash" : "UPI"} received · hand over`}</span>
              <span className="font-mono text-xs opacity-70">tap or tear →</span>
            </span>
          </TearButton>
        </div>
      )}
    </section>
  );
}

/** The student's half flies off; the counterfoil stays with the invoice number and print buttons. */
function Collected({ token, invoice, onNext }: { token: string; invoice: Invoice; onNext: () => void }) {
  return (
    <section aria-live="polite" className="relative">
      <div aria-hidden="true" className="paper pointer-events-none absolute inset-x-6 top-0 h-24 animate-tear-away" />
      <div className="lift">
        <div className="paper edge-torn-t flex flex-col items-center gap-4 px-6 pb-6 text-center">
          <Stamp tone="veg" land className="mt-2 text-2xl">
            Handed over
          </Stamp>
          <p className="condensed text-7xl font-extrabold leading-none">{token}</p>
          <p className="font-mono text-sm text-ink-muted">
            INV <span className="font-semibold text-ink">{invoice.number}</span> · <span className="font-semibold text-ink">{formatPaise(invoice.totalPaise)}</span>
          </p>
          <PrintLinks invoiceId={invoice.id} />
          <Button variant="accent" size="lg" onClick={onNext} className="w-full">
            Next ticket
          </Button>
        </div>
      </div>
    </section>
  );
}

function StatusStamp({ status }: { status: string }) {
  const label = status === "READY" ? "Ready" : status === "PREPARING" ? "Cooking" : "Placed";
  return <span className={cn("rubber-stamp -rotate-3 text-xs", status === "READY" ? "text-veg" : "text-stamp")}>{label}</span>;
}

function ScissorIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
      <circle cx="4" cy="4" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="4" cy="12" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.8 5.3L14 12M5.8 10.7L14 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
