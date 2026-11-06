import "server-only";
import { formatDocNumber, type Series } from "@/lib/doc-number";
import { computeBill, taxModeFor } from "@/lib/gst";
import { financialYear } from "@/lib/time";
import type { Tx } from "./db";

/**
 * Takes the next number in a series inside the caller's transaction. The
 * upsert holds a row lock on the counter until commit, so two counters billing
 * at once queue here, and a rolled-back transaction gives its number back.
 * That is why we don't use a Postgres SEQUENCE: sequences never roll back.
 */
export async function nextDocSeq(tx: Tx, canteenId: string, series: Series, fy: string): Promise<number> {
  const [row] = await tx.$queryRaw<{ lastSeq: number }[]>`
    INSERT INTO "DocCounter" ("canteenId", "series", "financialYear", "lastSeq")
    VALUES (${canteenId}, ${series}::"DocSeries", ${fy}, 1)
    ON CONFLICT ("canteenId", "series", "financialYear")
    DO UPDATE SET "lastSeq" = "DocCounter"."lastSeq" + 1
    RETURNING "lastSeq"`;
  return row.lastSeq;
}

export type Buyer = { name?: string | null; gstin?: string | null; stateCode?: string | null };

/**
 * Issues the invoice (or bill of supply) for an order. Must run inside the
 * transaction that marks the order paid, after the order row is locked.
 */
export async function issueInvoice(
  tx: Tx,
  args: { orderId: string; issuedById: string; paymentMode: "CASH" | "UPI"; buyer?: Buyer; now: Date },
): Promise<{ id: string; number: string; totalPaise: number }> {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: args.orderId },
    include: { lines: true, canteen: true, invoice: { select: { id: true, number: true, totalPaise: true } } },
  });
  if (order.invoice) return order.invoice;

  const { canteen } = order;
  const placeOfSupply = args.buyer?.stateCode || canteen.stateCode;
  const mode = taxModeFor(canteen.gstRegistered, canteen.stateCode, placeOfSupply);
  const bill = computeBill(
    order.lines.map((l) => ({
      key: l.id,
      name: l.name,
      hsnSac: l.hsnSac,
      quantity: l.quantity,
      unitPricePaise: l.unitPricePaise,
      priceIncludesGst: l.priceIncludesGst,
      gstRateBp: l.gstRateBp,
    })),
    mode,
  );

  const series: Series = canteen.gstRegistered ? "INV" : "BOS";
  const fy = financialYear(args.now);
  const seq = await nextDocSeq(tx, canteen.id, series, fy);
  const lineById = new Map(order.lines.map((l) => [l.id, l]));

  return tx.invoice.create({
    data: {
      canteenId: canteen.id,
      orderId: order.id,
      series,
      financialYear: fy,
      seq,
      number: formatDocNumber(canteen.invoicePrefix, series, fy, seq),
      issuedAt: args.now,
      issuedById: args.issuedById,
      paymentMode: args.paymentMode,
      buyerName: args.buyer?.name || null,
      buyerGstin: args.buyer?.gstin || null,
      supplierState: canteen.stateCode,
      placeOfSupply,
      isInterState: mode === "INTER_STATE",
      taxablePaise: bill.taxablePaise,
      cgstPaise: bill.cgstPaise,
      sgstPaise: bill.sgstPaise,
      igstPaise: bill.igstPaise,
      roundOffPaise: bill.roundOffPaise,
      totalPaise: bill.totalPaise,
      lines: {
        create: bill.lines.map((l) => ({
          itemId: lineById.get(l.key)!.itemId,
          name: l.name,
          hsnSac: l.hsnSac,
          quantity: l.quantity,
          unitPricePaise: l.unitPricePaise,
          gstRateBp: l.gstRateBp,
          costPaise: lineById.get(l.key)!.costPaise,
          taxablePaise: l.taxablePaise,
          cgstPaise: l.cgstPaise,
          sgstPaise: l.sgstPaise,
          igstPaise: l.igstPaise,
          totalPaise: l.totalPaise,
        })),
      },
    },
    select: { id: true, number: true, totalPaise: true },
  });
}
