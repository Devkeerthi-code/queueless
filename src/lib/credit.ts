import { roundDiv } from "./money";

export type LineAmounts = { taxablePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number; totalPaise: number };

const KEYS: (keyof LineAmounts)[] = ["taxablePaise", "cgstPaise", "sgstPaise", "igstPaise", "totalPaise"];

/**
 * Amounts to credit for `quantity` units of an invoice line. Partial returns
 * are pro-rata; the return that finishes the line takes whatever is left, so
 * several partial credit notes always add up to the original line exactly.
 */
export function creditAmounts(
  line: LineAmounts & { quantity: number },
  alreadyCreditedQty: number,
  alreadyCredited: LineAmounts,
  quantity: number,
): LineAmounts {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("credit quantity must be a positive integer");
  if (alreadyCreditedQty + quantity > line.quantity) throw new Error("cannot credit more than was invoiced");

  const finishesLine = alreadyCreditedQty + quantity === line.quantity;
  const out = {} as LineAmounts;
  for (const k of KEYS) {
    out[k] = finishesLine ? line[k] - alreadyCredited[k] : roundDiv(line[k] * quantity, line.quantity);
  }
  return out;
}

/** Stock can only be restored for food that was never made, on the same day it was reserved. */
export function canRestock(order: { preparingAt: Date | null; businessDate: Date }, today: Date): boolean {
  return order.preparingAt === null && order.businessDate.getTime() === today.getTime();
}
