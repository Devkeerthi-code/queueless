import { computeLine } from "@/lib/gst";
import { roundToRupee } from "@/lib/money";
import { LOW_STOCK_AT } from "@/lib/stock";
import type { MenuItemView } from "@/server/views";

export const MAX_PER_ITEM = 20;

export type Tray = Record<string, number>;
export type TrayLine = { item: MenuItemView; quantity: number };

export function maxFor(item: MenuItemView): number {
  return item.isAvailable ? Math.max(0, Math.min(item.remaining, MAX_PER_ITEM)) : 0;
}

/** Tray lines clamped to what is still in stock, so a stale tray can never over-order. */
export function trayLines(tray: Tray, items: MenuItemView[]): TrayLine[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  return Object.entries(tray).flatMap(([id, qty]) => {
    const item = byId.get(id);
    if (!item) return [];
    const quantity = Math.min(qty, maxFor(item));
    return quantity > 0 ? [{ item, quantity }] : [];
  });
}

/** Line amount including GST, computed exactly as the invoice will compute it. */
export function linePaise(item: MenuItemView, quantity: number): number {
  const line = { key: item.id, name: item.name, hsnSac: "", quantity, unitPricePaise: item.pricePaise, priceIncludesGst: item.priceIncludesGst, gstRateBp: item.gstRateBp };
  return computeLine(line, item.gstCharged ? "INTRA_STATE" : "UNREGISTERED").totalPaise;
}

/** What the counter will ask for: the bill rounded to the nearest rupee, like the invoice. */
export function trayTotal(lines: TrayLine[]): number {
  return roundToRupee(lines.reduce((sum, l) => sum + linePaise(l.item, l.quantity), 0));
}

export function trayCount(lines: TrayLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}

export type StockState = { kind: "sold-out" | "off" | "low" | "ok"; label: string };

export function stockState(item: MenuItemView): StockState {
  if (!item.isAvailable) return { kind: "off", label: "Not today" };
  if (item.remaining <= 0) return { kind: "sold-out", label: "Sold out" };
  if (item.remaining <= LOW_STOCK_AT) return { kind: "low", label: `Only ${item.remaining} left` };
  return { kind: "ok", label: "" };
}
