"use client";

import { formatPaise } from "@/lib/money";
import type { MenuItemView, SlotView, StudentMenuView } from "@/server/views";
import { Button } from "../ui/button";
import { maxFor, trayTotal, type TrayLine } from "./tray";

type Props = {
  usual: StudentMenuView["usual"];
  items: MenuItemView[];
  nextSlot: SlotView | null;
  pending: boolean;
  onReorder: (lines: TrayLine[], slot: SlotView) => void;
  onAddToTray: (lines: TrayLine[]) => void;
};

/** One tap repeats the last order for the next free slot. If something ran out, it says what. */
export function UsualCard({ usual, items, nextSlot, pending, onReorder, onAddToTray }: Props) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const lines: TrayLine[] = [];
  const missing: string[] = [];
  for (const u of usual) {
    const item = byId.get(u.itemId);
    if (item && maxFor(item) >= u.quantity) lines.push({ item, quantity: u.quantity });
    else missing.push(u.name);
  }
  const complete = missing.length === 0 && lines.length > 0;
  const summary = usual.map((u) => `${u.quantity}× ${u.name}`).join(", ");

  return (
    <section aria-labelledby="usual-title" className="slip relative overflow-hidden border-accent/60 bg-accent/10 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="usual-title" className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-ink">
          Your usual
        </h2>
        {complete && <span className="num text-sm font-semibold">{formatPaise(trayTotal(lines), { trimWhole: true })}</span>}
      </div>
      <p className="mt-1.5 line-clamp-2 text-[17px] font-semibold leading-snug">{summary}</p>
      {missing.length > 0 && <p className="mt-1 text-sm text-warn">{missing.join(", ")} {missing.length === 1 ? "isn't" : "aren't"} available right now.</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {complete && nextSlot ? (
          <Button variant="accent" pending={pending} onClick={() => onReorder(lines, nextSlot)} className="flex-1 sm:flex-none">
            {pending ? "Placing" : `Reorder for ${nextSlot.label}`}
          </Button>
        ) : null}
        {lines.length > 0 && (
          <Button variant="outline" onClick={() => onAddToTray(lines)} disabled={pending}>
            {complete && nextSlot ? "Change time" : "Add to tray"}
          </Button>
        )}
      </div>
    </section>
  );
}
