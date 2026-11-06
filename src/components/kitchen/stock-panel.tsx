"use client";

import { useState } from "react";
import { setAvailabilityAction } from "@/app/actions/orders";
import type { MenuItemView } from "@/server/views";
import { Button } from "../ui/button";
import { Switch } from "../ui/field";
import { Sheet } from "../ui/sheet";
import { VegMark } from "../ui/veg-mark";
import { useAction } from "../use-action";

/** "We've run out of paneer" in two taps, without calling the owner. */
export function StockPanel({ items }: { items: MenuItemView[] }) {
  const [open, setOpen] = useState(false);
  const [available, setAvailable] = useState(() => Object.fromEntries(items.map((i) => [i.id, i.isAvailable])));
  const { run, pending } = useAction();
  const offCount = Object.values(available).filter((v) => !v).length;

  function toggle(item: MenuItemView, next: boolean) {
    setAvailable((a) => ({ ...a, [item.id]: next }));
    run(() => setAvailabilityAction(item.id, next), {
      success: next ? `${item.name} is back on the menu` : `${item.name} marked out of stock`,
      onError: () => setAvailable((a) => ({ ...a, [item.id]: !next })),
    });
  }

  return (
    <>
      <Button variant="outline" size="lg" onClick={() => setOpen(true)}>
        Out of stock{offCount > 0 && <span className="num rounded-[4px] bg-danger px-1.5 text-sm text-on-ink">{offCount}</span>}
      </Button>
      <Sheet variant="drawer" open={open} onClose={() => setOpen(false)} title="What's available" description="Switch an item off and students stop seeing it within seconds.">
        <ul className="divide-y divide-line px-5">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-3">
              <VegMark isVeg={item.isVeg} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{item.name}</span>
                <span className="font-mono text-sm text-ink-muted">{item.remaining} left today</span>
              </span>
              <Switch label={available[item.id] ? "On" : "Off"} checked={available[item.id] ?? false} disabled={pending} onChange={(e) => toggle(item, e.target.checked)} aria-label={`${item.name} available`} />
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
