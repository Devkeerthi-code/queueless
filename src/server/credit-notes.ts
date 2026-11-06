import "server-only";
import { z } from "zod";
import { canRestock, creditAmounts, type LineAmounts } from "@/lib/credit";
import { formatDocNumber } from "@/lib/doc-number";
import { roundToRupee } from "@/lib/money";
import { isActive, type Status } from "@/lib/noshow";
import { assertCan } from "@/lib/permissions";
import { businessDate, financialYear } from "@/lib/time";
import type { Actor } from "./actor";
import { nextDocSeq } from "./billing";
import { prisma, TX_OPTIONS } from "./db";
import { UserError } from "./errors";
import { releaseSlot, releaseStock } from "./inventory";
import { track } from "./usage";

export const creditNoteSchema = z.object({
  invoiceId: z.string().min(1).max(40),
  reason: z.string().trim().min(3, "Say why, e.g. 'Wrong item served'.").max(200),
  lines: z
    .array(z.object({ invoiceLineId: z.string().min(1).max(40), quantity: z.number().int().min(1).max(500), restock: z.boolean() }))
    .min(1, "Pick at least one item to refund."),
});

const ZERO: LineAmounts = { taxablePaise: 0, cgstPaise: 0, sgstPaise: 0, igstPaise: 0, totalPaise: 0 };

/**
 * Issues a credit note against an invoice. The invoice row is locked first so
 * two refunds of the same bill can't both pass the "not more than invoiced" check.
 */
export async function issueCreditNote(actor: Actor, input: unknown, now = new Date()) {
  assertCan(actor.role, "invoice:credit-note");
  const data = creditNoteSchema.parse(input);
  const today = businessDate(now);

  const note = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Invoice" WHERE "id" = ${data.invoiceId} AND "canteenId" = ${actor.canteenId} FOR UPDATE`;
    if (locked.length === 0) throw new UserError("Invoice not found.", "NOT_FOUND");

    const invoice = await tx.invoice.findUniqueOrThrow({
      where: { id: data.invoiceId },
      include: { lines: { include: { creditLines: true } }, order: true, canteen: true },
    });
    const restockAllowed = canRestock(invoice.order, today);

    const computed = data.lines.map((req) => {
      const line = invoice.lines.find((l) => l.id === req.invoiceLineId);
      if (!line) throw new UserError("That item isn't on this invoice.");
      const creditedQty = line.creditLines.reduce((s, c) => s + c.quantity, 0);
      if (creditedQty + req.quantity > line.quantity) {
        throw new UserError(`Only ${line.quantity - creditedQty} × ${line.name} can still be refunded.`);
      }
      if (req.restock && !restockAllowed) {
        throw new UserError("Stock can only go back if the kitchen never started this order and it's still the same day.");
      }
      const credited = line.creditLines.reduce<LineAmounts>(
        (acc, c) => ({
          taxablePaise: acc.taxablePaise + c.taxablePaise,
          cgstPaise: acc.cgstPaise + c.cgstPaise,
          sgstPaise: acc.sgstPaise + c.sgstPaise,
          igstPaise: acc.igstPaise + c.igstPaise,
          totalPaise: acc.totalPaise + c.totalPaise,
        }),
        ZERO,
      );
      return { req, line, amounts: creditAmounts(line, creditedQty, credited, req.quantity) };
    });

    const sum = (k: keyof LineAmounts) => computed.reduce((s, c) => s + c.amounts[k], 0);
    const gross = sum("totalPaise");
    const fy = financialYear(now);
    const seq = await nextDocSeq(tx, invoice.canteenId, "CN", fy);

    const created = await tx.creditNote.create({
      data: {
        canteenId: invoice.canteenId,
        invoiceId: invoice.id,
        financialYear: fy,
        seq,
        number: formatDocNumber(invoice.canteen.invoicePrefix, "CN", fy, seq),
        issuedAt: now,
        issuedById: actor.userId,
        reason: data.reason,
        taxablePaise: sum("taxablePaise"),
        cgstPaise: sum("cgstPaise"),
        sgstPaise: sum("sgstPaise"),
        igstPaise: sum("igstPaise"),
        roundOffPaise: roundToRupee(gross) - gross,
        totalPaise: roundToRupee(gross),
        lines: {
          create: computed.map((c) => ({ invoiceLineId: c.line.id, quantity: c.req.quantity, restocked: c.req.restock, ...c.amounts })),
        },
      },
      select: { id: true, number: true, totalPaise: true },
    });

    const restock = computed.filter((c) => c.req.restock).map((c) => ({ itemId: c.line.itemId, quantity: c.req.quantity }));
    if (restock.length) await releaseStock(tx, restock, invoice.order.businessDate);

    const fullyCredited = invoice.lines.every((l) => {
      const before = l.creditLines.reduce((s, c) => s + c.quantity, 0);
      const inThisNote = computed.filter((c) => c.line.id === l.id).reduce((s, c) => s + c.req.quantity, 0);
      return before + inThisNote === l.quantity;
    });
    // A fully refunded order that hasn't been handed over is off: free its slot and clear it from the kitchen.
    if (fullyCredited && isActive(invoice.order.status as Status)) {
      if (invoice.order.slotId) await releaseSlot(tx, invoice.order.slotId);
      await tx.order.update({ where: { id: invoice.orderId }, data: { status: "CANCELLED", cancelledAt: now, stockReleased: true } });
    }
    return created;
  }, TX_OPTIONS);

  await track(prisma, actor.canteenId, "CREDIT_NOTE", actor.userId);
  return note;
}
