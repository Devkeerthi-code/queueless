"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { walkInAction } from "@/app/actions/orders";
import { validateGstin } from "@/lib/gstin";
import { formatPaise } from "@/lib/money";
import type { MenuItemView } from "@/server/views";
import { linePaise, maxFor, trayLines, trayTotal, type Tray } from "../student/tray";
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
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="lift animate-rise">
          <div className="paper edge-torn-t flex flex-col items-center gap-4 px-6 pb-6 text-center">
            <Stamp tone="veg" land className="mt-2 text-2xl">
              Paid · to kitchen
            </Stamp>
            <div className="rounded-[3px] bg-accent px-5 py-2 text-on-accent">
              <p className="caps text-[10px]">Token no.</p>
              <p className="condensed text-token font-extrabold">{billed.token}</p>
            </div>
            <p className="font-mono text-sm text-ink-muted">
              MEMO <span className="font-semibold text-ink">{billed.number}</span> · <span className="font-semibold text-ink">{formatPaise(billed.totalPaise)}</span>
            </p>
            <PrintLinks invoiceId={billed.invoiceId} />
            <Button variant="accent" size="lg" onClick={() => setBilled(null)} className="mt-2 w-full">
              Next memo
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 pb-24 pt-5 lg:grid-cols-[minmax(0,1fr)_400px] lg:pb-10">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex items-center gap-3">
          <Link href="/counter" className="rounded-slip py-1 text-sm font-semibold text-ink-muted hover:text-ink">
            ← Counter
          </Link>
          <h1 className="condensed text-3xl font-extrabold uppercase">Cash memo</h1>
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
                  className={cn("press flex h-20 w-full flex-col justify-between rounded-[3px] p-2.5 text-left shadow-[0_1px_0_rgb(0_0_0/0.18),0_4px_8px_-4px_rgb(0_0_0/0.3)] disabled:opacity-50", qty ? "bg-accent text-on-accent" : "bg-surface hover:brightness-[.97]")}
                  aria-label={`Add ${item.name}${qty ? `, ${qty} in bill` : ""}`}
                >
                  <span className="flex items-start gap-1.5">
                    <VegMark isVeg={item.isVeg} className="mt-0.5" />
                    <span className="line-clamp-2 text-sm font-semibold leading-tight">{item.name}</span>
                  </span>
                  <span className="flex items-baseline justify-between text-sm">
                    <span className="font-mono">{formatPaise(item.pricePaise, { trimWhole: true })}</span>
                    {max === 0 ? <span className="text-xs">Out</span> : qty > 0 && <span key={qty} className="condensed animate-stamp text-xl font-extrabold">×{qty}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <aside id="memo" aria-label="Cash memo" className="carbon h-fit scroll-mt-20 lg:sticky lg:top-20">
        <div className="lift">
          <div className="paper flex flex-col gap-4 rounded-[3px] p-5">
            <div className="flex items-baseline justify-between border-b-2 border-ink pb-2">
              <h2 className="condensed text-2xl font-extrabold uppercase">Cash memo</h2>
              <span className="font-mono text-xs text-ink-muted">No. ______</span>
            </div>
            <div className="ruled min-h-[9rem] font-mono text-[14px]">
              <div className="grid h-9 grid-cols-[2.5rem_minmax(0,1fr)_5rem] items-center gap-2 text-[11px] font-semibold text-ink-muted">
                <span>QTY</span>
                <span>PARTICULARS</span>
                <span className="text-right">AMOUNT</span>
              </div>
              {lines.length === 0 ? (
                <p className="h-9 leading-9 text-ink-muted">Tap items to write them in.</p>
              ) : (
                <ul>
                  {lines.map((l) => (
                    <li key={l.item.id} className="grid h-9 animate-feed grid-cols-[2.5rem_minmax(0,1fr)_5rem] items-center gap-2">
                      <span className="flex items-center gap-0.5">
                        <button type="button" className="press grid size-6 place-items-center rounded-full text-ink-muted hover:bg-sunken hover:text-ink" onClick={() => add(l.item.id, -1, maxFor(l.item))} aria-label={`One less ${l.item.name}`}>
                          −
                        </button>
                        <span className="font-bold">{l.quantity}</span>
                      </span>
                      <span className="truncate">{l.item.name}</span>
                      <span className="text-right">{formatPaise(linePaise(l.item, l.quantity))}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <details className="rounded-[3px] border border-dashed border-line px-3 py-2">
              <summary className="text-sm font-semibold">Buyer details for a GST invoice (optional)</summary>
              <div className="mt-3 flex flex-col gap-3 pb-1">
                <Field label="Buyer name" id="buyer-name" error={fields.buyerName}>
                  <Input {...fieldA11y("buyer-name", fields.buyerName)} value={buyer.name} onChange={(e) => setBuyer({ ...buyer, name: e.target.value })} />
                </Field>
                <Field label="Buyer GSTIN" id="buyer-gstin" error={gstinError}>
                  <Input {...fieldA11y("buyer-gstin", gstinError)} className="font-mono uppercase" maxLength={15} value={buyer.gstin} onChange={(e) => setBuyer({ ...buyer, gstin: e.target.value.toUpperCase() })} />
                </Field>
              </div>
            </details>
            <PaymentMode value={mode} onChange={setMode} name="walkin-mode" />
            <div className="flex items-baseline justify-between border-t-2 border-double border-ink pt-3 font-mono">
              <span className="text-sm font-semibold">TOTAL</span>
              <span className="text-3xl font-bold">{formatPaise(trayTotal(lines))}</span>
            </div>
            <Button variant="accent" size="lg" pending={pending} disabled={lines.length === 0 || gstinBad} onClick={bill}>
              {pending ? "Billing" : "Bill and send to kitchen"}
            </Button>
          </div>
        </div>
      </aside>
      {lines.length > 0 && (
        <a href="#memo" className="lift fixed inset-x-3 bottom-3 z-20 lg:hidden">
          <span className="paper flex items-center gap-3 rounded-[3px] px-4 py-3 font-mono text-sm font-semibold">
            MEMO · {lines.reduce((n, l) => n + l.quantity, 0)} ITEMS
            <span className="ml-auto text-lg">{formatPaise(trayTotal(lines))}</span>
            <span className="rounded-[3px] bg-ink px-2.5 py-1.5 font-sans text-on-ink">Bill ↓</span>
          </span>
        </a>
      )}
    </div>
  );
}
