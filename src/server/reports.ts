import "server-only";
import { addDays, businessDate, IST_OFFSET_MIN, isoDate } from "@/lib/time";
import { prisma } from "./db";

// Every date bucket is the IST calendar day of the instant.
const IST = `${IST_OFFSET_MIN} minutes`;

export type Range = { from: Date; to: Date }; // business dates, inclusive

export function lastNDays(now: Date, n: number): Range {
  const to = businessDate(now);
  return { from: addDays(to, -(n - 1)), to };
}

export function monthOf(now: Date): Range {
  const today = businessDate(now);
  const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
  return { from, to };
}

/** Converts an inclusive business-date range into a half-open instant range. */
function instants(range: Range) {
  return {
    start: new Date(range.from.getTime() - IST_OFFSET_MIN * 60_000),
    end: new Date(addDays(range.to, 1).getTime() - IST_OFFSET_MIN * 60_000),
  };
}

export type DailySales = { day: string; invoices: number; salesPaise: number; taxablePaise: number; taxPaise: number; costPaise: number; profitPaise: number };

/**
 * Sales net of credit notes. Profit is taxable value minus cost, because GST
 * collected belongs to the government, not the canteen.
 */
export async function dailySales(canteenId: string, range: Range): Promise<DailySales[]> {
  const { start, end } = instants(range);
  const rows = await prisma.$queryRaw<
    { day: Date; invoices: number; sales: bigint; taxable: bigint; tax: bigint; cost: bigint }[]
  >`
    WITH inv AS (
      SELECT (i."issuedAt" + ${IST}::interval)::date AS day, COUNT(*)::int AS invoices,
             SUM(i."totalPaise") AS sales, SUM(i."taxablePaise") AS taxable,
             SUM(i."cgstPaise" + i."sgstPaise" + i."igstPaise") AS tax,
             SUM((SELECT COALESCE(SUM(l."costPaise" * l."quantity"), 0) FROM "InvoiceLine" l WHERE l."invoiceId" = i."id")) AS cost
      FROM "Invoice" i WHERE i."canteenId" = ${canteenId} AND i."issuedAt" >= ${start} AND i."issuedAt" < ${end}
      GROUP BY 1
    ), cn AS (
      SELECT (c."issuedAt" + ${IST}::interval)::date AS day, SUM(c."totalPaise") AS sales, SUM(c."taxablePaise") AS taxable,
             SUM(c."cgstPaise" + c."sgstPaise" + c."igstPaise") AS tax,
             SUM((SELECT COALESCE(SUM(il."costPaise" * cl."quantity"), 0) FROM "CreditNoteLine" cl
                  JOIN "InvoiceLine" il ON il."id" = cl."invoiceLineId" WHERE cl."creditNoteId" = c."id" AND cl."restocked")) AS cost
      FROM "CreditNote" c WHERE c."canteenId" = ${canteenId} AND c."issuedAt" >= ${start} AND c."issuedAt" < ${end}
      GROUP BY 1
    )
    SELECT d::date AS day, COALESCE(inv.invoices, 0) AS invoices,
           COALESCE(inv.sales, 0) - COALESCE(cn.sales, 0) AS sales,
           COALESCE(inv.taxable, 0) - COALESCE(cn.taxable, 0) AS taxable,
           COALESCE(inv.tax, 0) - COALESCE(cn.tax, 0) AS tax,
           COALESCE(inv.cost, 0) - COALESCE(cn.cost, 0) AS cost
    FROM generate_series(${isoDate(range.from)}::date, ${isoDate(range.to)}::date, '1 day') d
    LEFT JOIN inv ON inv.day = d::date LEFT JOIN cn ON cn.day = d::date
    ORDER BY 1`;
  return rows.map((r) => ({
    day: isoDate(r.day),
    invoices: r.invoices,
    salesPaise: Number(r.sales),
    taxablePaise: Number(r.taxable),
    taxPaise: Number(r.tax),
    costPaise: Number(r.cost),
    profitPaise: Number(r.taxable) - Number(r.cost),
  }));
}

export type GstRow = { gstRateBp: number; taxablePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number };

/** GST by rate for the period, invoices minus credit notes (the shape GSTR-1's rate-wise summary needs). */
export async function gstSummary(canteenId: string, range: Range): Promise<GstRow[]> {
  const { start, end } = instants(range);
  const rows = await prisma.$queryRaw<{ rate: number; taxable: bigint; cgst: bigint; sgst: bigint; igst: bigint }[]>`
    SELECT rate, SUM(taxable) AS taxable, SUM(cgst) AS cgst, SUM(sgst) AS sgst, SUM(igst) AS igst FROM (
      SELECT l."gstRateBp" AS rate, l."taxablePaise" AS taxable, l."cgstPaise" AS cgst, l."sgstPaise" AS sgst, l."igstPaise" AS igst
      FROM "InvoiceLine" l JOIN "Invoice" i ON i."id" = l."invoiceId"
      WHERE i."canteenId" = ${canteenId} AND i."series" = 'INV' AND i."issuedAt" >= ${start} AND i."issuedAt" < ${end}
      UNION ALL
      SELECT il."gstRateBp", -cl."taxablePaise", -cl."cgstPaise", -cl."sgstPaise", -cl."igstPaise"
      FROM "CreditNoteLine" cl JOIN "CreditNote" c ON c."id" = cl."creditNoteId"
      JOIN "InvoiceLine" il ON il."id" = cl."invoiceLineId" JOIN "Invoice" i ON i."id" = c."invoiceId"
      WHERE c."canteenId" = ${canteenId} AND i."series" = 'INV' AND c."issuedAt" >= ${start} AND c."issuedAt" < ${end}
    ) x GROUP BY rate ORDER BY rate`;
  return rows.map((r) => ({
    gstRateBp: r.rate,
    taxablePaise: Number(r.taxable),
    cgstPaise: Number(r.cgst),
    sgstPaise: Number(r.sgst),
    igstPaise: Number(r.igst),
  }));
}

export type ItemPerformance = { itemId: string; name: string; isAvailable: boolean; quantity: number; salesPaise: number; profitPaise: number };

/** Every live item, including ones that sold nothing, ranked by units sold. */
export async function itemPerformance(canteenId: string, range: Range): Promise<ItemPerformance[]> {
  const { start, end } = instants(range);
  const rows = await prisma.$queryRaw<{ id: string; name: string; available: boolean; qty: bigint; sales: bigint; profit: bigint }[]>`
    SELECT m."id", m."name", m."isAvailable" AS available,
           COALESCE(SUM(l."quantity"), 0) AS qty, COALESCE(SUM(l."totalPaise"), 0) AS sales,
           COALESCE(SUM(l."taxablePaise" - l."costPaise" * l."quantity"), 0) AS profit
    FROM "MenuItem" m
    LEFT JOIN "InvoiceLine" l ON l."itemId" = m."id"
      AND l."invoiceId" IN (SELECT "id" FROM "Invoice" WHERE "canteenId" = ${canteenId} AND "issuedAt" >= ${start} AND "issuedAt" < ${end})
    WHERE m."canteenId" = ${canteenId} AND m."archivedAt" IS NULL
    GROUP BY m."id" ORDER BY qty DESC, m."name"`;
  return rows.map((r) => ({
    itemId: r.id,
    name: r.name,
    isAvailable: r.available,
    quantity: Number(r.qty),
    salesPaise: Number(r.sales),
    profitPaise: Number(r.profit),
  }));
}

export type HeatCell = { weekday: number; minute: number; orders: number };

/** Pre-orders by weekday and pickup time, to show when the rush really is. */
export async function slotHeatmap(canteenId: string, range: Range): Promise<HeatCell[]> {
  const { start, end } = instants(range);
  const rows = await prisma.$queryRaw<{ weekday: number; minute: number; orders: number }[]>`
    SELECT EXTRACT(DOW FROM s."startsAt" + ${IST}::interval)::int AS weekday,
           (EXTRACT(HOUR FROM s."startsAt" + ${IST}::interval) * 60 + EXTRACT(MINUTE FROM s."startsAt" + ${IST}::interval))::int AS minute,
           COUNT(o."id")::int AS orders
    FROM "Order" o JOIN "PickupSlot" s ON s."id" = o."slotId"
    WHERE o."canteenId" = ${canteenId} AND o."status" <> 'CANCELLED' AND s."startsAt" >= ${start} AND s."startsAt" < ${end}
    GROUP BY 1, 2 ORDER BY 1, 2`;
  return rows;
}

export type NoShowStats = { collected: number; noShows: number; rate: number; wastedUnits: number; wastedCostPaise: number };

/** No-show rate among pre-orders that reached a final state, and the food that was made for nobody. */
export async function noShowStats(canteenId: string, range: Range): Promise<NoShowStats> {
  const [row] = await prisma.$queryRaw<{ collected: number; noshows: number; units: bigint; cost: bigint }[]>`
    SELECT COUNT(*) FILTER (WHERE o."status" = 'COLLECTED')::int AS collected,
           COUNT(*) FILTER (WHERE o."status" = 'NO_SHOW')::int AS noshows,
           COALESCE(SUM(w.units), 0) AS units, COALESCE(SUM(w.cost), 0) AS cost
    FROM "Order" o
    LEFT JOIN LATERAL (
      SELECT SUM(l."quantity") AS units, SUM(l."quantity" * l."costPaise") AS cost FROM "OrderLine" l
      WHERE l."orderId" = o."id" AND o."status" = 'NO_SHOW' AND o."preparingAt" IS NOT NULL
    ) w ON TRUE
    WHERE o."canteenId" = ${canteenId} AND o."source" = 'ONLINE'
      AND o."businessDate" BETWEEN ${isoDate(range.from)}::date AND ${isoDate(range.to)}::date`;
  const finished = row.collected + row.noshows;
  return {
    collected: row.collected,
    noShows: row.noshows,
    rate: finished === 0 ? 0 : row.noshows / finished,
    wastedUnits: Number(row.units),
    wastedCostPaise: Number(row.cost),
  };
}

export type WastedItem = { name: string; units: number; costPaise: number };

export async function wastedItems(canteenId: string, range: Range): Promise<WastedItem[]> {
  const rows = await prisma.$queryRaw<{ name: string; units: bigint; cost: bigint }[]>`
    SELECT l."name", SUM(l."quantity") AS units, SUM(l."quantity" * l."costPaise") AS cost
    FROM "OrderLine" l JOIN "Order" o ON o."id" = l."orderId"
    WHERE o."canteenId" = ${canteenId} AND o."status" = 'NO_SHOW' AND o."preparingAt" IS NOT NULL
      AND o."businessDate" BETWEEN ${isoDate(range.from)}::date AND ${isoDate(range.to)}::date
    GROUP BY l."name" ORDER BY units DESC`;
  return rows.map((r) => ({ name: r.name, units: Number(r.units), costPaise: Number(r.cost) }));
}

/** Suggested quantity for tomorrow: the average sold on the same weekday over the last four weeks, plus 10%. */
export async function demandForecast(canteenId: string, now: Date): Promise<Map<string, number>> {
  const target = addDays(businessDate(now), 1);
  const days = [1, 2, 3, 4].map((w) => isoDate(addDays(target, -7 * w)));
  const rows = await prisma.$queryRaw<{ itemId: string; qty: bigint }[]>`
    SELECT l."itemId", SUM(l."quantity") AS qty FROM "OrderLine" l JOIN "Order" o ON o."id" = l."orderId"
    WHERE o."canteenId" = ${canteenId} AND o."status" IN ('COLLECTED', 'READY', 'PREPARING', 'PLACED')
      AND o."businessDate" = ANY(${days}::date[])
    GROUP BY l."itemId"`;
  return new Map(rows.map((r) => [r.itemId, Math.ceil((Number(r.qty) / 4) * 1.1)]));
}

export async function usageCounts(canteenId: string) {
  const [students, orders, events] = await Promise.all([
    prisma.user.count({ where: { canteenId, role: "STUDENT" } }),
    prisma.order.count({ where: { canteenId, status: { not: "CANCELLED" } } }),
    prisma.usageEvent.groupBy({ by: ["type"], where: { canteenId }, _count: { _all: true } }),
  ]);
  return { students, orders, events: Object.fromEntries(events.map((e) => [e.type, e._count._all])) as Record<string, number> };
}
