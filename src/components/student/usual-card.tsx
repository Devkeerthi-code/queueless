"use client";

import { formatPaise } from "@/lib/money";
import type { MenuItemView, SlotView, StudentMenuView } from "@/server/views";
import { TearButton } from "../paper/tear-button";
import { Spinner } from "../ui/button";
import { maxFor, trayTotal, type TrayLine } from "./tray";

type Props = {
  usual: StudentMenuView["usual"];
  items: MenuItemView[];
  nextSlot: SlotView | null;
  pending: boolean;
  onReorder: (lines: TrayLine[], slot: SlotView) => void;
  onAddToTray: (lines: TrayLine[]) => void;
};

/**
 * Your usual, pre-printed on turmeric coupon stock. One tap on the stub (or a tear) re-orders it
 * for the next free slot. If something ran out, it says what.
 */
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
    <section aria-labelledby="usual-title" className="lift">
      <div className="edge-perf flex items-stretch bg-accent text-on-accent">
        <div className="min-w-0 flex-1 px-4 py-4">
          <h2 id="usual-title" className="caps">
            Your usual
          </h2>
          <p className="mt-1 line-clamp-2 text-[17px] font-semibold leading-snug">{summary}</p>
          {missing.length > 0 ? (
            <p className="mt-1 text-sm font-medium">
              {missing.join(", ")} {missing.length === 1 ? "isn't" : "aren't"} available right now.
            </p>
          ) : (
            <p className="mt-1 font-mono text-sm font-semibold">{formatPaise(trayTotal(lines), { trimWhole: true })} · pay at counter</p>
          )}
          {lines.length > 0 && (
            <button type="button" onClick={() => onAddToTray(lines)} disabled={pending} className="mt-2 text-sm font-semibold underline underline-offset-4 disabled:opacity-50">
              {complete ? "Change time or items" : "Add the rest to my tray"}
            </button>
          )}
        </div>
        {complete && nextSlot && (
          <>
            <div className="w-0.5 self-stretch bg-[radial-gradient(circle,#1c1a17_1.4px,transparent_1.8px)] bg-[length:2px_7px] bg-repeat-y opacity-50" aria-hidden="true" />
            <TearButton onTear={() => onReorder(lines, nextSlot)} disabled={pending} tug={false} label={`Reorder your usual for ${nextSlot.label}`} className="w-28 shrink-0 hover:bg-black/5">
              <span className="flex flex-col items-center px-2 text-center leading-tight">
                {pending ? <Spinner className="size-5" /> : <span className="caps text-[10px]">Tear to order</span>}
                <span className="condensed mt-1 text-2xl font-extrabold">{nextSlot.label}</span>
                <span className="caps text-[10px]">pickup</span>
              </span>
            </TearButton>
          </>
        )}
      </div>
    </section>
  );
}
