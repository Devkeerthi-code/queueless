"use client";

import Image from "next/image";
import { formatPaise } from "@/lib/money";
import type { MenuItemView } from "@/server/views";
import { TearButton } from "../paper/tear-button";
import { cn } from "../ui/cn";
import { VegMark } from "../ui/veg-mark";
import { maxFor, stockState } from "./tray";

type Props = {
  item: MenuItemView;
  quantity: number;
  favourite: boolean;
  onQuantity: (next: number) => void;
  onFavourite: () => void;
};

/**
 * One line of the printed rate card, with a coupon stub on the right.
 * Tap the stub (or tear it off sideways) to add one; the stub turns turmeric and shows how many.
 */
export function MenuItemRow({ item, quantity, favourite, onQuantity, onFavourite }: Props) {
  const stock = stockState(item);
  const max = maxFor(item);
  const unavailable = max === 0;
  const full = quantity >= max;

  return (
    <li className={cn("relative flex items-stretch border-b border-dashed border-line last:border-b-0", unavailable && "text-ink-muted")}>
      <div className="flex min-w-0 flex-1 gap-3 py-3 pl-4 pr-3">
        {item.photoUrl && <Image src={item.photoUrl} alt="" width={48} height={48} unoptimized className="size-12 shrink-0 rounded-[3px] object-cover sepia-[.15]" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <VegMark isVeg={item.isVeg} className="translate-y-0.5" />
            <h3 className={cn("min-w-0 truncate text-[16px] font-semibold", unavailable && "line-through decoration-1")}>{item.name}</h3>
            <span className="leader" aria-hidden="true" />
            <span className="shrink-0 font-mono text-[15px] font-semibold">{formatPaise(item.pricePaise, { trimWhole: true })}</span>
          </div>
          <div className="mt-1 flex min-h-7 items-center gap-2 pl-6 text-[13px]">
            {!item.priceIncludesGst && item.gstCharged && <span className="font-mono text-ink-muted">+GST</span>}
            {stock.kind === "low" && <span className="font-mono font-semibold uppercase text-warn">{stock.label}</span>}
            <FavouriteButton on={favourite} name={item.name} onClick={onFavourite} />
            {quantity > 0 && (
              <button
                type="button"
                onClick={() => onQuantity(quantity - 1)}
                className="press ml-auto flex h-7 items-center gap-1 rounded-full border border-line px-2.5 font-mono text-xs font-semibold text-ink-muted hover:border-ink hover:text-ink"
                aria-label={`Remove one ${item.name}`}
              >
                − 1
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="perf-v" aria-hidden="true" />
      {unavailable ? (
        <div className="grid w-[4.5rem] shrink-0 place-items-center">
          <span className="rubber-stamp -rotate-12 text-[11px] text-danger">{stock.kind === "off" ? "Not today" : "Sold out"}</span>
        </div>
      ) : (
        <TearButton
          onTear={() => onQuantity(quantity + 1)}
          disabled={full}
          label={full ? `No more ${item.name} available` : quantity ? `Add another ${item.name}, ${quantity} in tray` : `Add ${item.name}`}
          className={cn("w-[4.5rem] shrink-0 transition-colors duration-150", quantity ? "bg-accent text-on-accent" : "text-ink hover:bg-sunken", full && "opacity-70")}
        >
          {quantity ? (
            <span key={quantity} className="flex animate-stamp flex-col items-center leading-none">
              <span className="condensed text-3xl font-extrabold">×{quantity}</span>
              <span className="caps mt-1 text-[9px]">{full ? "max" : "+1"}</span>
            </span>
          ) : (
            <span className="flex flex-col items-center leading-none">
              <span className="text-2xl font-light">+</span>
              <span className="caps mt-1 text-[9px]">Add</span>
            </span>
          )}
        </TearButton>
      )}
    </li>
  );
}

function FavouriteButton({ on, name, onClick }: { on: boolean; name: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={on ? `Remove ${name} from favourites` : `Save ${name} as a favourite`}
      className={cn("press -my-1 grid size-8 place-items-center rounded-full", on ? "text-accent-ink" : "text-ink-muted hover:text-ink")}
    >
      <svg viewBox="0 0 16 16" className={cn("size-4", on && "animate-stamp")} aria-hidden="true">
        <path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
