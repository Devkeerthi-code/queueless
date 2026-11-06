"use client";

import Image from "next/image";
import { formatPaise } from "@/lib/money";
import type { MenuItemView } from "@/server/views";
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

export function MenuItemRow({ item, quantity, favourite, onQuantity, onFavourite }: Props) {
  const stock = stockState(item);
  const max = maxFor(item);
  const unavailable = max === 0;

  return (
    <li className={cn("flex items-center gap-3 border-b border-line py-3 last:border-b-0", unavailable && "opacity-60")}>
      {item.photoUrl && (
        <Image src={item.photoUrl} alt="" width={56} height={56} unoptimized className="size-14 shrink-0 rounded-slip border border-line object-cover" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <VegMark isVeg={item.isVeg} />
          <h3 className={cn("truncate font-semibold", unavailable && "line-through decoration-ink-muted")}>{item.name}</h3>
          <FavouriteButton on={favourite} name={item.name} onClick={onFavourite} />
        </div>
        <p className="mt-0.5 flex items-center gap-2 text-sm">
          <span className="num font-semibold">{formatPaise(item.pricePaise, { trimWhole: true })}</span>
          {!item.priceIncludesGst && <span className="text-ink-muted">+ GST</span>}
          {stock.kind === "low" && <span className="font-semibold text-warn">{stock.label}</span>}
        </p>
      </div>
      {unavailable ? (
        <span className="rubber-stamp -rotate-6 text-xs text-ink-muted">{stock.label}</span>
      ) : quantity === 0 ? (
        <button
          type="button"
          onClick={() => onQuantity(1)}
          className="press h-10 min-w-20 rounded-slip border border-ink bg-surface px-4 text-sm font-semibold hover:bg-ink hover:text-paper"
          aria-label={`Add ${item.name}`}
        >
          Add
        </button>
      ) : (
        <Stepper name={item.name} quantity={quantity} max={max} onChange={onQuantity} />
      )}
    </li>
  );
}

function Stepper({ name, quantity, max, onChange }: { name: string; quantity: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="flex h-10 items-center rounded-slip bg-ink text-paper" role="group" aria-label={`${name} quantity`}>
      <button type="button" className="press grid h-10 w-10 place-items-center rounded-l-slip text-lg font-semibold" onClick={() => onChange(quantity - 1)} aria-label={`Remove one ${name}`}>
        −
      </button>
      <span key={quantity} className="num inline-block w-6 animate-stamp text-center font-bold" aria-live="polite">
        {quantity}
      </span>
      <button
        type="button"
        className="press grid h-10 w-10 place-items-center rounded-r-slip text-lg font-semibold disabled:opacity-40"
        onClick={() => onChange(quantity + 1)}
        disabled={quantity >= max}
        aria-label={quantity >= max ? `No more ${name} available` : `Add one more ${name}`}
      >
        +
      </button>
    </div>
  );
}

function FavouriteButton({ on, name, onClick }: { on: boolean; name: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={on ? `Remove ${name} from favourites` : `Save ${name} as a favourite`}
      className={cn("press -m-2 grid size-9 shrink-0 place-items-center rounded-slip", on ? "text-accent-ink" : "text-ink-muted/60 hover:text-ink")}
    >
      <svg viewBox="0 0 16 16" className={cn("size-4", on && "animate-stamp")} aria-hidden="true">
        <path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
