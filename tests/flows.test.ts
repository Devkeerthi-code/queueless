import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { issueCreditNote } from "@/server/credit-notes";
import { prisma } from "@/server/db";
import { importMenuCsv } from "@/server/menu";
import { recentNoShowCount, sweepNoShows } from "@/server/noshows";
import { advanceOrder, billWalkIn, cancelOrder, collectOrder, placeOrder, takePayment } from "@/server/orders";
import { dailySales, gstSummary, noShowStats } from "@/server/reports";
import { businessDate } from "@/lib/time";
import { createFixture, hasDatabase, NOW, type Fixture } from "./helpers/fixture";

const describeDb = hasDatabase ? describe : describe.skip;
const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000);

async function reserved(itemId: string) {
  const row = await prisma.dailyStock.findUnique({ where: { itemId_businessDate: { itemId, businessDate: businessDate(NOW) } } });
  return row?.reserved ?? 0;
}

describeDb("order, billing and refund flows (real Postgres)", () => {
  let fx: Fixture;
  beforeAll(async () => {
    fx = await createFixture();
  });
  afterAll(async () => {
    await fx?.cleanup();
    await prisma.$disconnect();
  });

  const order = async (student: Parameters<typeof placeOrder>[0], itemId: string, quantity = 1, slotIndex = 0) =>
    placeOrder(student, { lines: [{ itemId, quantity }], slotStartsAt: fx.slot(slotIndex).startsAt.toISOString() }, NOW);

  it("a full credit note on an unprepared walk-in restores stock and cancels it", async () => {
    const roll = await fx.item({ dailyQuantity: 10, pricePaise: 6_000 });
    const { invoice } = await billWalkIn(fx.counter, { lines: [{ itemId: roll.id, quantity: 3 }], paymentMode: "CASH" }, NOW);
    expect(await reserved(roll.id)).toBe(3);

    const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: { lines: true } });
    const note = await issueCreditNote(
      fx.owner,
      { invoiceId: inv.id, reason: "Customer changed their mind", lines: [{ invoiceLineId: inv.lines[0].id, quantity: 3, restock: true }] },
      NOW,
    );
    expect(note.totalPaise).toBe(inv.totalPaise);
    expect(note.number).toMatch(/^TC\/2627\/0000\d$/);
    expect(await reserved(roll.id)).toBe(0);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: inv.orderId } })).status).toBe("CANCELLED");
  });

  it("partial credit notes add up exactly and can't exceed what was billed", async () => {
    const thali = await fx.item({ dailyQuantity: 10, pricePaise: 8_500 });
    const { invoice } = await billWalkIn(fx.counter, { lines: [{ itemId: thali.id, quantity: 3 }], paymentMode: "UPI" }, NOW);
    const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: { lines: true } });
    const lineId = inv.lines[0].id;

    const one = await issueCreditNote(fx.owner, { invoiceId: inv.id, reason: "One cold", lines: [{ invoiceLineId: lineId, quantity: 1, restock: false }] }, NOW);
    await expect(
      issueCreditNote(fx.owner, { invoiceId: inv.id, reason: "Too many", lines: [{ invoiceLineId: lineId, quantity: 3, restock: false }] }, NOW),
    ).rejects.toThrow(/Only 2/);
    await issueCreditNote(fx.owner, { invoiceId: inv.id, reason: "Rest", lines: [{ invoiceLineId: lineId, quantity: 2, restock: false }] }, NOW);

    const notes = await prisma.creditNote.findMany({ where: { invoiceId: inv.id }, include: { lines: true } });
    const credited = notes.flatMap((n) => n.lines).reduce((s, l) => s + l.totalPaise, 0);
    expect(credited).toBe(inv.lines[0].totalPaise);
    expect(one.totalPaise).toBeGreaterThan(0);
    // Not restocked: the food was served.
    expect(await reserved(thali.id)).toBe(3);
  });

  it("refuses to restock food the kitchen already started", async () => {
    const dosa = await fx.item({ dailyQuantity: 10 });
    const { order: o, invoice } = await billWalkIn(fx.counter, { lines: [{ itemId: dosa.id, quantity: 1 }], paymentMode: "CASH" }, NOW);
    await advanceOrder(fx.kitchen, o.id, NOW);
    const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: { lines: true } });
    await expect(
      issueCreditNote(fx.owner, { invoiceId: inv.id, reason: "Burnt", lines: [{ invoiceLineId: inv.lines[0].id, quantity: 1, restock: true }] }, NOW),
    ).rejects.toThrow(/never started/);
  });

  it("only the owner can issue credit notes", async () => {
    const tea = await fx.item();
    const { invoice } = await billWalkIn(fx.counter, { lines: [{ itemId: tea.id, quantity: 1 }], paymentMode: "CASH" }, NOW);
    const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: { lines: true } });
    const input = { invoiceId: inv.id, reason: "Test refund", lines: [{ invoiceLineId: inv.lines[0].id, quantity: 1, restock: false }] };
    await expect(issueCreditNote(fx.counter, input, NOW)).rejects.toThrow(/can't do this/);
    await expect(issueCreditNote(fx.kitchen, input, NOW)).rejects.toThrow(/can't do this/);
  });

  it("enforces roles at the service layer, not just in the UI", async () => {
    const [student] = await fx.students(1);
    const juice = await fx.item();
    const o = await order(student, juice.id);
    await expect(advanceOrder(student, o.id, NOW)).rejects.toThrow(/can't do this/);
    await expect(collectOrder(fx.kitchen, o.id, "CASH", NOW)).rejects.toThrow(/can't do this/);
    await expect(importMenuCsv(fx.counter, "name\n", NOW)).rejects.toThrow(/can't do this/);
    await expect(billWalkIn(student, { lines: [{ itemId: juice.id, quantity: 1 }], paymentMode: "CASH" }, NOW)).rejects.toThrow(/can't do this/);
    const [other] = await fx.students(1);
    await expect(cancelOrder(other, o.id, NOW)).rejects.toThrow(/can't do this/);
  });

  it("marks overdue orders as no-shows, gives back unprepared stock and counts prepared food as waste", async () => {
    const [student] = await fx.students(1);
    const pongal = await fx.item({ dailyQuantity: 20 });
    const untouched = await order(student, pongal.id, 2, 0);
    const started = await order(student, pongal.id, 1, 0);
    await advanceOrder(fx.kitchen, started.id, NOW);
    expect(await reserved(pongal.id)).toBe(3);

    const slot = fx.slot(0);
    const afterGrace = new Date(slot.endsAt.getTime() + 31 * 60_000);
    expect(await recentNoShowCount(prisma, student.userId, 30, afterGrace)).toBe(2);
    const result = await sweepNoShows(fx.canteen.id, afterGrace);
    expect(result.marked).toBeGreaterThanOrEqual(2);

    expect((await prisma.order.findUniqueOrThrow({ where: { id: untouched.id } })).status).toBe("NO_SHOW");
    expect(await reserved(pongal.id)).toBe(1);
    const stats = await noShowStats(fx.canteen.id, { from: businessDate(NOW), to: businessDate(NOW) });
    expect(stats.wastedUnits).toBeGreaterThanOrEqual(1);

    // Two no-shows: the next order must be paid before the kitchen may start it.
    const next = await placeOrder(student, { lines: [{ itemId: pongal.id, quantity: 1 }], slotStartsAt: fx.slot(8).startsAt.toISOString() }, minutes(0));
    expect(next.requiresPrepay).toBe(true);
    await expect(advanceOrder(fx.kitchen, next.id, NOW)).rejects.toThrow(/must pay/);
    await takePayment(fx.counter, next.id, "UPI", NOW);
    await expect(advanceOrder(fx.kitchen, next.id, NOW)).resolves.toMatchObject({ status: "PREPARING" });
    // Paying first doesn't issue a second invoice at hand-over.
    await advanceOrder(fx.kitchen, next.id, NOW);
    await collectOrder(fx.counter, next.id, "UPI", NOW);
    expect(await prisma.invoice.count({ where: { orderId: next.id } })).toBe(1);
  });

  it("rejects slots inside the cut-off and made-up slot times", async () => {
    const [student] = await fx.students(1);
    const vada = await fx.item();
    const soon = fx.slot(0).startsAt;
    await expect(
      placeOrder(student, { lines: [{ itemId: vada.id, quantity: 1 }], slotStartsAt: soon.toISOString() }, new Date(soon.getTime() - 5 * 60_000)),
    ).rejects.toThrow(/closed 10 minutes/);
    await expect(
      placeOrder(student, { lines: [{ itemId: vada.id, quantity: 1 }], slotStartsAt: new Date(soon.getTime() + 60_000).toISOString() }, NOW),
    ).rejects.toThrow(/isn't one of today's slots/);
  });

  it("reports net sales and GST after credit notes", async () => {
    const range = { from: businessDate(NOW), to: businessDate(NOW) };
    const [sales] = await dailySales(fx.canteen.id, range);
    const invoiced = await prisma.invoice.aggregate({ where: { canteenId: fx.canteen.id }, _sum: { totalPaise: true } });
    const credited = await prisma.creditNote.aggregate({ where: { canteenId: fx.canteen.id }, _sum: { totalPaise: true } });
    expect(sales.salesPaise).toBe((invoiced._sum.totalPaise ?? 0) - (credited._sum.totalPaise ?? 0));
    const gst = await gstSummary(fx.canteen.id, range);
    expect(gst.every((r) => r.cgstPaise === r.sgstPaise)).toBe(true);
  });
});
