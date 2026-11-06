"use client";

import { formatPaise } from "@/lib/money";
import { Button } from "../ui/button";
import { VegMark } from "../ui/veg-mark";
import { linePaise, trayCount, trayTotal, type TrayLine } from "./tray";

/** Sticky bar on phones: count, total, and the one button that matters. */
export function TrayBar({ lines, onCheckout, disabled }: { lines: TrayLine[]; onCheckout: () => void; disabled: boolean }) {
  if (lines.length === 0) return null;
  const count = trayCount(lines);
  const total = trayTotal(lines);
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 animate-rise px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 lg:hidden">
      <button
        type="button"
        onClick={onCheckout}
        disabled={disabled}
        className="press flex h-14 w-full items-center gap-3 rounded-slip bg-ink px-4 text-paper shadow-[0_8px_24px_rgb(0_0_0/0.18)] disabled:opacity-60"
      >
        <span className="num grid h-8 min-w-8 place-items-center overflow-hidden rounded-[4px] bg-accent px-1.5 text-sm font-bold text-on-accent">
          <span key={count} className="animate-roll">
            {count}
          </span>
        </span>
        <span className="font-semibold">{count === 1 ? "item" : "items"}</span>
        <span key={total} className="num ml-auto animate-roll font-bold">
          {formatPaise(total, { trimWhole: true })}
        </span>
        <span className="font-semibold">Pick time →</span>
      </button>
    </div>
  );
}

/** The desktop tray: a receipt in the right column. */
export function TrayPanel({ lines, onCheckout, disabled }: { lines: TrayLine[]; onCheckout: () => void; disabled: boolean }) {
  return (
    <aside aria-label="Your tray" className="slip sticky top-20 hidden p-5 lg:block">
      <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Your tray</h2>
      {lines.length === 0 ? (
        <p className="mt-6 pb-4 text-center text-sm text-ink-muted">Nothing yet. Tap Add on anything in the menu.</p>
      ) : (
        <>
          <ul className="mt-4 space-y-2.5">
            {lines.map((l) => (
              <li key={l.item.id} className="flex items-center gap-2 text-[15px]">
                <VegMark isVeg={l.item.isVeg} />
                <span className="num font-semibold">{l.quantity}×</span>
                <span className="min-w-0 flex-1 truncate">{l.item.name}</span>
                <span className="num">{formatPaise(linePaise(l.item, l.quantity), { trimWhole: true })}</span>
              </li>
            ))}
          </ul>
          <hr className="tear-line my-4" />
          <p className="flex items-baseline justify-between">
            <span className="text-sm text-ink-muted">Pay at counter</span>
            <span key={trayTotal(lines)} className="num animate-roll text-2xl font-bold">
              {formatPaise(trayTotal(lines), { trimWhole: true })}
            </span>
          </p>
          <Button variant="ink" size="lg" className="mt-4 w-full" onClick={onCheckout} disabled={disabled}>
            Pick pickup time
          </Button>
        </>
      )}
    </aside>
  );
}
