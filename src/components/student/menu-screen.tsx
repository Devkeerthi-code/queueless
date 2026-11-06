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
    <div className="mx-auto max-w-6xl px-3 pb-36 pt-4 sm:px-4 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10 lg:pb-12">
      <div className="flex min-w-0 flex-col gap-4">
        <ActiveOrders orders={data.activeOrders} />
        {data.usual.length > 0 && nextSlot !== null && (
          <UsualCard usual={data.usual} items={data.items} nextSlot={nextSlot} pending={order.pending} onReorder={(l, s: SlotView) => place(l, s.startsAt, true)} onAddToTray={addUsualToTray} />
        )}
        {nextSlot === null && <ClosedNotice canteen={data.canteen} anySlots={upcomingSlots(data.slots).length > 0} />}

        {data.items.length > 0 && (
          <nav aria-label="Categories" className="no-scrollbar sticky top-14 z-10 -mx-3 flex gap-1.5 overflow-x-auto bg-counter/92 px-3 py-2 backdrop-blur-sm sm:-mx-4 sm:px-4 lg:mx-0 lg:px-0">
            {chips.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
                className={cn(
                  "press h-9 shrink-0 rounded-[3px] px-3.5 text-sm font-semibold shadow-[0_1px_0_rgb(0_0_0/0.15)]",
                  category === c ? "bg-accent text-on-accent" : "bg-surface text-ink-muted hover:text-ink",
                )}
              >
                {c}
              </button>
            ))}
          </nav>
        )}

        <section aria-labelledby="rate-card" className="lift">
          <div className="paper edge-torn-b">
            <RateCardHeading canteen={data.canteen} day={data.slots[0]?.startsAt ?? null} nextSlot={nextSlot} status={status} />
            {data.items.length === 0 ? (
              <EmptyState title="Nothing on the rate card yet" className="m-4">
                The canteen hasn&apos;t added today&apos;s items. Check back in a bit.
              </EmptyState>
            ) : shown.length === 0 ? (
              <EmptyState title="No favourites yet" className="m-4">
                Tap the star next to an item to keep it here.
              </EmptyState>
            ) : (
              <ul aria-label={`${category} items`}>
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
          </div>
        </section>
      </div>

      <div className="hidden lg:block">
        <TrayPanel lines={lines} onCheckout={openCheckout} disabled={nextSlot === null} />
      </div>
      <TrayBar lines={lines} onCheckout={openCheckout} disabled={nextSlot === null} />

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Pick a pickup time" description={`Ordering closes ${data.canteen.cutoffMinutes} min before each slot.`}>
        <div className="flex flex-col gap-5 p-5">
          {upcomingSlots(data.slots).length === 0 ? (
            <p className="text-ink-muted">No pickup times left today.</p>
          ) : (
            <SlotPicker slots={data.slots} value={chosenSlot?.startsAt ?? null} onChange={setSlot} />
          )}
          <div className="flex items-baseline justify-between border-t border-dashed border-line pt-4 font-mono">
            <span className="text-sm">TOTAL · PAY AT COUNTER</span>
            <span className="text-xl font-bold">{formatPaise(trayTotal(lines), { trimWhole: true })}</span>
          </div>
          <Button
            variant="accent"
            size="lg"
            pending={order.pending}
            disabled={!chosenSlot || lines.length === 0}
            onClick={() => chosenSlot && place(lines, chosenSlot.startsAt, false)}
          >
            {order.pending ? "Printing your token" : chosenSlot ? `Print token for ${chosenSlot.label}` : "Pick a time"}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

/** The printed head of the rate card: who, when, and whether this sheet is live. */
const DAY = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" });

function RateCardHeading({ canteen, day, nextSlot, status }: { canteen: StudentMenuView["canteen"]; day: string | null; nextSlot: SlotView | null; status: PollStatus }) {
  return (
    <header className="border-b-2 border-ink px-4 pb-3 pt-4">
      <div className="flex items-start justify-between gap-3">
        <p className="caps text-ink-muted">{canteen.name}</p>
        <LiveDot status={status} />
      </div>
      <h1 id="rate-card" className="condensed mt-1 text-5xl font-extrabold uppercase leading-none tracking-[-0.01em]">
        Rate card
      </h1>
      <p className="mt-2 font-mono text-[13px] text-ink-muted">
        {day && `${DAY.format(new Date(day)).toUpperCase()} · `}
        {canteen.opensAt}–{canteen.closesAt}
        {nextSlot && (
          <>
            {" · "}NEXT PICKUP <span className="font-semibold text-ink">{nextSlot.label}</span>
          </>
        )}
      </p>
    </header>
  );
}

function ClosedNotice({ canteen, anySlots }: { canteen: StudentMenuView["canteen"]; anySlots: boolean }) {
  return (
    <div className="paper hatched edge-perf-x px-5 py-3">
      <p className="font-semibold">{anySlots ? "Every pickup slot left today is full" : "Ordering is closed for today"}</p>
      <p className="text-sm text-ink-muted">
        {anySlots ? "Slots free up when someone cancels. This page updates on its own." : `No more pickup times today. The canteen is open ${canteen.opensAt} to ${canteen.closesAt} on working days.`}
      </p>
    </div>
  );
}
