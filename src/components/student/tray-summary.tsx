"use client";

import { formatPaise } from "@/lib/money";
import { Button } from "../ui/button";
import { cn } from "../ui/cn";
import { VegMark } from "../ui/veg-mark";
import { linePaise, trayCount, trayTotal, type TrayLine } from "./tray";

/** Phones: the bill pinned to the bottom edge, showing the last line printed and the total. */
export function TrayBar({ lines, onCheckout, disabled }: { lines: TrayLine[]; onCheckout: () => void; disabled: boolean }) {
  if (lines.length === 0) return null;
  const count = trayCount(lines);
  const total = trayTotal(lines);
  const last = lines[lines.length - 1];
  return (
    <div className="lift fixed inset-x-0 bottom-0 z-20 lg:hidden">
      <button
        type="button"
        onClick={onCheckout}
        disabled={disabled}
        className="paper edge-torn-t flex w-full flex-col px-4 pb-[max(12px,env(safe-area-inset-bottom))] text-left disabled:cursor-not-allowed"
        aria-label={`Bill: ${count} ${count === 1 ? "item" : "items"}, ${formatPaise(total)}. ${disabled ? "Ordering is closed" : "Pick a pickup time"}`}
      >
        <span key={`${last.item.id}-${last.quantity}`} className="flex animate-feed items-center gap-2 font-mono text-[13px] text-ink-muted">
          <span>{last.quantity}×</span>
          <span className="min-w-0 flex-1 truncate">{last.item.name}</span>
          <span>{formatPaise(linePaise(last.item, last.quantity), { trimWhole: true })}</span>
        </span>
        <span className="mt-1.5 flex items-center gap-3 border-t border-dashed border-line pt-2">
          <span className="font-mono text-sm font-semibold">
            BILL · <span key={count} className="inline-block animate-roll">{count}</span> {count === 1 ? "ITEM" : "ITEMS"}
          </span>
          <span key={total} className="ml-auto animate-roll font-mono text-xl font-bold">
            {formatPaise(total, { trimWhole: true })}
          </span>
          <span className={cn("rounded-[3px] px-3 py-2 text-sm font-semibold", disabled ? "bg-sunken text-ink-muted" : "bg-ink text-on-ink")}>{disabled ? "Ordering closed" : "Pick time →"}</span>
        </span>
      </button>
    </div>
  );
}

/** Desktop: the bill as a thermal receipt in the right column, one printed line per item. */
export function TrayPanel({ lines, onCheckout, disabled }: { lines: TrayLine[]; onCheckout: () => void; disabled: boolean }) {
  return (
    <aside aria-label="Your bill" className="lift sticky top-20 hidden lg:block">
      <div className="paper edge-torn-b px-5 pt-5">
        <p className="text-center font-mono text-xs font-semibold tracking-widest">*** YOUR BILL ***</p>
        <hr className="tear-line my-3" />
        {lines.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-muted">Nothing yet. Tap the stub next to anything on the rate card.</p>
        ) : (
          <>
            <ul className="space-y-1.5 font-mono text-[14px]">
              {lines.map((l) => (
                <li key={`${l.item.id}-${l.quantity}`} className="flex animate-feed items-center gap-2">
                  <VegMark isVeg={l.item.isVeg} className="size-3.5" />
                  <span>{l.quantity}×</span>
                  <span className="min-w-0 flex-1 truncate">{l.item.name}</span>
                  <span>{formatPaise(linePaise(l.item, l.quantity), { trimWhole: true })}</span>
                </li>
              ))}
            </ul>
            <hr className="tear-line my-3" />
            <p className="flex items-baseline justify-between font-mono">
              <span className="text-sm font-semibold">TOTAL</span>
              <span key={trayTotal(lines)} className="animate-roll text-2xl font-bold">
                {formatPaise(trayTotal(lines), { trimWhole: true })}
              </span>
            </p>
            <p className="mt-1 text-right font-mono text-[11px] text-ink-muted">PAY AT COUNTER · CASH / UPI</p>
            <Button variant="ink" size="lg" className="mb-2 mt-4 w-full" onClick={onCheckout} disabled={disabled}>
              {disabled ? "Ordering closed" : "Pick pickup time"}
            </Button>
          </>
        )}
      </div>
    </aside>
  );
}
