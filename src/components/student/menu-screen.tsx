"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { placeOrderAction, toggleFavouriteAction } from "@/app/actions/orders";
import { formatPaise } from "@/lib/money";
import type { SlotView, StudentMenuView } from "@/server/views";
import { Button } from "../ui/button";
import { cn } from "../ui/cn";
import { EmptyState } from "../ui/empty-state";
import { LiveDot } from "../ui/live-dot";
import { Sheet } from "../ui/sheet";
import { useAction } from "../use-action";
import { usePoll, type PollStatus } from "../use-poll";
import { ActiveOrders } from "./active-orders";
import { MenuItemRow } from "./menu-item-row";
import { SlotPicker, upcomingSlots } from "./slot-picker";
import { trayLines, trayTotal, type Tray, type TrayLine } from "./tray";
import { TrayBar, TrayPanel } from "./tray-summary";
import { UsualCard } from "./usual-card";

const FAVOURITES = "Favourites";
const ALL = "All";

export function MenuScreen({ initial }: { initial: StudentMenuView }) {
  const router = useRouter();
  const { data, status, refresh } = usePoll("/api/menu/live", initial);
  const [tray, setTray] = useState<Tray>({});
  const [category, setCategory] = useState(ALL);
  const [favourites, setFavourites] = useState(() => new Set(initial.favouriteIds));
  const [sheetOpen, setSheetOpen] = useState(false);
  const [slot, setSlot] = useState<string | null>(null);
  const order = useAction();
  const fav = useAction();

  const lines = trayLines(tray, data.items);
  const bookable = data.slots.filter((s) => s.bookable);
  const nextSlot = bookable[0] ?? null;
  const chosenSlot = bookable.find((s) => s.startsAt === slot) ?? null;
  const categories = useMemo(() => [...new Set(data.items.map((i) => i.category))], [data.items]);
  const chips = [ALL, ...(favourites.size ? [FAVOURITES] : []), ...categories];
  const shown = data.items.filter((i) => (category === ALL ? true : category === FAVOURITES ? favourites.has(i.id) : i.category === category));

  const setQuantity = (id: string, qty: number) =>
    setTray((t) => {
      const next = { ...t };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });

  function toggleFavourite(id: string) {
    setFavourites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    fav.run(() => toggleFavouriteAction(id), { onError: () => setFavourites(new Set(data.favouriteIds)) });
  }

  function place(toPlace: TrayLine[], startsAt: string, isReorder: boolean) {
    order.run(
      () => placeOrderAction({ lines: toPlace.map((l) => ({ itemId: l.item.id, quantity: l.quantity })), slotStartsAt: startsAt, isReorder }),
      {
        onOk: ({ id }) => {
          setTray({});
          setSheetOpen(false);
          router.push(`/orders/${id}`);
        },
        onError: (r) => {
          if (r.code === "SOLD_OUT" || r.code === "SLOT_FULL") refresh();
        },
      },
    );
  }

  function openCheckout() {
    if (!chosenSlot) setSlot(nextSlot?.startsAt ?? null);
    setSheetOpen(true);
  }

  function addUsualToTray(usual: TrayLine[]) {
    setTray(Object.fromEntries(usual.map((l) => [l.item.id, l.quantity])));
    openCheckout();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-32 pt-5 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10 lg:pb-12">
      <div className="flex min-w-0 flex-col gap-5">
        <MenuHeading canteen={data.canteen} nextSlot={nextSlot} status={status} />
        <ActiveOrders orders={data.activeOrders} />
        {data.usual.length > 0 && nextSlot !== null && (
          <UsualCard usual={data.usual} items={data.items} nextSlot={nextSlot} pending={order.pending} onReorder={(l, s: SlotView) => place(l, s.startsAt, true)} onAddToTray={addUsualToTray} />
        )}
        {nextSlot === null && <ClosedNotice canteen={data.canteen} anySlots={upcomingSlots(data.slots).length > 0} />}

        {data.items.length === 0 ? (
          <EmptyState title="The menu is empty today">The canteen hasn&apos;t added today&apos;s items yet. Check back in a bit.</EmptyState>
        ) : (
          <>
            <nav aria-label="Categories" className="no-scrollbar sticky top-14 z-10 -mx-4 flex gap-2 overflow-x-auto bg-paper/95 px-4 py-2 backdrop-blur-sm lg:mx-0 lg:px-0">
              {chips.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={category === c}
                  onClick={() => setCategory(c)}
                  className={cn(
                    "press h-9 shrink-0 rounded-full border px-4 text-sm font-semibold",
                    category === c ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink-muted hover:text-ink",
                  )}
                >
                  {c}
                </button>
              ))}
            </nav>
            {shown.length === 0 ? (
              <EmptyState title="No favourites here yet">Tap the star next to an item to keep it at the top.</EmptyState>
            ) : (
              <ul className="slip px-4" aria-label={`${category} items`}>
                {shown.map((item) => (
                  <MenuItemRow
                    key={item.id}
                    item={item}
                    quantity={lines.find((l) => l.item.id === item.id)?.quantity ?? 0}
                    favourite={favourites.has(item.id)}
                    onQuantity={(q) => setQuantity(item.id, q)}
                    onFavourite={() => toggleFavourite(item.id)}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <div className="hidden lg:block">
        <TrayPanel lines={lines} onCheckout={openCheckout} disabled={nextSlot === null} />
      </div>
      <TrayBar lines={lines} onCheckout={openCheckout} disabled={nextSlot === null} />

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Pick a pickup time" description={`Orders close ${data.canteen.cutoffMinutes} min before each slot.`}>
        <div className="flex flex-col gap-5 p-5">
          {upcomingSlots(data.slots).length === 0 ? (
            <p className="text-ink-muted">No pickup times left today.</p>
          ) : (
            <SlotPicker slots={data.slots} value={chosenSlot?.startsAt ?? null} onChange={setSlot} />
          )}
          <div className="flex items-center justify-between border-t border-line pt-4">
            <span className="text-sm text-ink-muted">Pay at the counter when you collect</span>
            <span className="num text-xl font-bold">{formatPaise(trayTotal(lines), { trimWhole: true })}</span>
          </div>
          <Button
            variant="accent"
            size="lg"
            pending={order.pending}
            disabled={!chosenSlot || lines.length === 0}
            onClick={() => chosenSlot && place(lines, chosenSlot.startsAt, false)}
          >
            {order.pending ? "Placing order" : chosenSlot ? `Place order for ${chosenSlot.label}` : "Pick a time"}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

function MenuHeading({ canteen, nextSlot, status }: { canteen: StudentMenuView["canteen"]; nextSlot: SlotView | null; status: PollStatus }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <h1 className="condensed text-4xl font-extrabold tracking-[-0.01em]">Today&apos;s menu</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {canteen.opensAt} to {canteen.closesAt}
          {nextSlot && (
            <>
              {" · "}next pickup <span className="num font-semibold text-ink">{nextSlot.label}</span>
            </>
          )}
        </p>
      </div>
      <LiveDot status={status} />
    </div>
  );
}

function ClosedNotice({ canteen, anySlots }: { canteen: StudentMenuView["canteen"]; anySlots: boolean }) {
  return (
    <div className="hatched rounded-slip border border-line bg-surface px-4 py-3">
      <p className="font-semibold">{anySlots ? "Every pickup slot left today is full" : "Ordering is closed for today"}</p>
      <p className="text-sm text-ink-muted">
        {anySlots ? "Slots free up when someone cancels. This page updates on its own." : `No more pickup times today. The canteen is open ${canteen.opensAt} to ${canteen.closesAt} on working days.`}
      </p>
    </div>
  );
}
