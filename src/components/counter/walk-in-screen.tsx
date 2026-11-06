"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { walkInAction } from "@/app/actions/orders";
import { validateGstin } from "@/lib/gstin";
import { formatPaise } from "@/lib/money";
import type { MenuItemView } from "@/server/views";
import { maxFor, trayLines, trayTotal, type Tray } from "../student/tray";
import { Button } from "../ui/button";
import { cn } from "../ui/cn";
import { Field, fieldA11y, Input } from "../ui/field";
import { Stamp } from "../ui/stamp";
import { VegMark } from "../ui/veg-mark";
import { useAction } from "../use-action";
import { PaymentMode, type Mode } from "./payment-mode";
import { PrintLinks } from "./print-links";

type Billed = { token: string; invoiceId: string; number: string; totalPaise: number };

export function WalkInScreen({ items }: { items: MenuItemView[] }) {
  const router = useRouter();
  const [tray, setTray] = useState<Tray>({});
  const [mode, setMode] = useState<Mode>("CASH");
  const [buyer, setBuyer] = useState({ name: "", gstin: "" });
  const [query, setQuery] = useState("");
  const [billed, setBilled] = useState<Billed | null>(null);
  const { run, pending, fields } = useAction();

  const lines = trayLines(tray, items);
  const shown = items.filter((i) => i.name.toLowerCase().includes(query.trim().toLowerCase()));
  const gstinCheck = buyer.gstin.trim() ? validateGstin(buyer.gstin) : null;
  const gstinBad = gstinCheck !== null && !gstinCheck.ok;
  const gstinError = gstinCheck && !gstinCheck.ok && buyer.gstin.length >= 15 ? gstinCheck.reason : fields.buyerGstin;
  const add = (id: string, delta: number, max: number) =>
    setTray((t) => {
      const q = Math.max(0, Math.min(max, (t[id] ?? 0) + delta));
      const next = { ...t };
      if (q === 0) delete next[id];
      else next[id] = q;
      return next;
    });

  function bill() {
    run(
      () =>
        walkInAction({
          lines: lines.map((l) => ({ itemId: l.item.id, quantity: l.quantity })),
          paymentMode: mode,
          buyerName: buyer.name.trim() || undefined,
          buyerGstin: buyer.gstin.trim().toUpperCase() || undefined,
        }),
      {
        onOk: (res) => {
          setBilled(res);
          setTray({});
          setBuyer({ name: "", gstin: "" });
          router.refresh();
        },
      },
    );
  }

  if (billed) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-10 text-center">
        <Stamp tone="veg" land className="text-2xl">
          Billed
        </Stamp>
        <p className="num condensed text-token font-extrabold">{billed.token}</p>
        <p className="text-ink-muted">
          Sent to the kitchen. Invoice <span className="num font-semibold text-ink">{billed.number}</span> · <span className="num font-semibold text-ink">{formatPaise(billed.totalPaise)}</span>
        </p>
        <PrintLinks invoiceId={billed.invoiceId} />
        <Button variant="accent" size="lg" onClick={() => setBilled(null)} className="mt-2 w-full">
          New bill
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 pb-40 pt-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:pb-10">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex items-center gap-3">
          <Link href="/counter" className="rounded-slip py-1 text-sm font-semibold text-ink-muted hover:text-ink">
            ← Counter
          </Link>
          <h1 className="condensed text-3xl font-extrabold">Walk-in bill</h1>
        </div>
        <Input aria-label="Search items" type="search" placeholder="Search items" value={query} onChange={(e) => setQuery(e.target.value)} />
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {shown.map((item) => {
            const max = maxFor(item);
            const qty = tray[item.id] ?? 0;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={max === 0 || qty >= max}
                  onClick={() => add(item.id, 1, max)}
                  className={cn("press flex h-20 w-full flex-col justify-between rounded-slip border p-2.5 text-left disabled:opacity-50", qty ? "border-ink bg-ink text-paper" : "border-line bg-surface hover:border-ink/40")}
                  aria-label={`Add ${item.name}${qty ? `, ${qty} in bill` : ""}`}
                >
                  <span className="flex items-start gap-1.5">
                    <VegMark isVeg={item.isVeg} className="mt-0.5" />
                    <span className="line-clamp-2 text-sm font-semibold leading-tight">{item.name}</span>
                  </span>
                  <span className="flex items-baseline justify-between text-sm">
                    <span className="num">{formatPaise(item.pricePaise, { trimWhole: true })}</span>
                    {max === 0 ? <span className="text-xs">Out</span> : qty > 0 && <span key={qty} className="num animate-stamp font-bold">×{qty}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <aside aria-label="Bill" className="slip flex h-fit flex-col gap-4 p-5 lg:sticky lg:top-20">
        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Bill</h2>
        {lines.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-muted">Tap items to add them.</p>
        ) : (
          <ul className="space-y-2">
            {lines.map((l) => (
              <li key={l.item.id} className="flex items-center gap-2 text-[15px]">
                <span className="min-w-0 flex-1 truncate">{l.item.name}</span>
                <button type="button" className="press grid size-8 place-items-center rounded-slip border border-line" onClick={() => add(l.item.id, -1, maxFor(l.item))} aria-label={`One less ${l.item.name}`}>
                  −
                </button>
                <span className="num w-6 text-center font-bold">{l.quantity}</span>
                <button type="button" className="press grid size-8 place-items-center rounded-slip border border-line disabled:opacity-40" disabled={l.quantity >= maxFor(l.item)} onClick={() => add(l.item.id, 1, maxFor(l.item))} aria-label={`One more ${l.item.name}`}>
                  +
                </button>
              </li>
            ))}
          </ul>
        )}
        <details className="rounded-slip border border-line px-3 py-2">
          <summary className="text-sm font-semibold">Buyer details for a GST invoice (optional)</summary>
          <div className="mt-3 flex flex-col gap-3 pb-1">
            <Field label="Buyer name" id="buyer-name" error={fields.buyerName}>
              <Input {...fieldA11y("buyer-name", fields.buyerName)} value={buyer.name} onChange={(e) => setBuyer({ ...buyer, name: e.target.value })} />
            </Field>
            <Field label="Buyer GSTIN" id="buyer-gstin" error={gstinError}>
              <Input {...fieldA11y("buyer-gstin", gstinError)} className="num uppercase" maxLength={15} value={buyer.gstin} onChange={(e) => setBuyer({ ...buyer, gstin: e.target.value.toUpperCase() })} />
            </Field>
          </div>
        </details>
        <PaymentMode value={mode} onChange={setMode} name="walkin-mode" />
        <div className="flex items-baseline justify-between border-t border-dashed border-line pt-3">
          <span className="text-sm text-ink-muted">Approx. total</span>
          <span className="num text-3xl font-bold">{formatPaise(trayTotal(lines))}</span>
        </div>
        <Button variant="accent" size="lg" pending={pending} disabled={lines.length === 0 || gstinBad} onClick={bill}>
          {pending ? "Billing" : "Bill and send to kitchen"}
        </Button>
      </aside>
    </div>
  );
}
