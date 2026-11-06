"use client";

import { cn } from "../ui/cn";

export type Mode = "CASH" | "UPI";

/** Cash or UPI as a two-segment radio group: one tap, big targets. */
export function PaymentMode({ value, onChange, name }: { value: Mode; onChange: (m: Mode) => void; name: string }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">Payment</legend>
      <div className="grid grid-cols-2 gap-1 rounded-slip border border-line bg-sunken p-1">
        {(["CASH", "UPI"] as const).map((m) => (
          <label key={m} className="press">
            <input type="radio" name={name} value={m} checked={value === m} onChange={() => onChange(m)} className="peer sr-only" />
            <span
              className={cn(
                "flex h-11 items-center justify-center rounded-[4px] text-[15px] font-semibold text-ink-muted transition-colors duration-150",
                "peer-checked:bg-surface peer-checked:text-ink peer-checked:shadow-[0_1px_0_var(--line)] peer-focus-visible:outline-2 peer-focus-visible:outline-ink",
              )}
            >
              {m === "CASH" ? "Cash" : "UPI"}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
