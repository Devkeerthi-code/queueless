import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { cancelOrder, collectOrder, placeOrder } from "@/server/orders";
import { businessDate, isoDate } from "@/lib/time";
import { createFixture, hasDatabase, NOW, type Fixture } from "./helpers/fixture";

const describeDb = hasDatabase ? describe : describe.skip;

async function stockRow(itemId: string) {
  return prisma.dailyStock.findUniqueOrThrow({ where: { itemId_businessDate: { itemId, businessDate: businessDate(NOW) } } });
}

describeDb("concurrency (real Postgres)", () => {
  let fx: Fixture;
  beforeAll(async () => {
    fx = await createFixture({ maxOrdersPerSlot: 500 });
  });
  afterAll(async () => {
    await fx?.cleanup();
    await prisma.$disconnect();
  });

  it("50 students racing for the last 10 samosas: exactly 10 win, stock never oversells", async () => {
    const samosa = await fx.item({ dailyQuantity: 10 });
    const students = await fx.students(50);
    const slot = fx.slot();

    const results = await Promise.allSettled(
      students.map((s) => placeOrder(s, { lines: [{ itemId: samosa.id, quantity: 1 }], slotStartsAt: slot.startsAt.toISOString() }, NOW)),
    );

    const won = results.filter((r) => r.status === "fulfilled");
    const lost = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(won).toHaveLength(10);
    expect(lost).toHaveLength(40);
    for (const r of lost) expect((r.reason as { code?: string }).code).toBe("SOLD_OUT");

    const stock = await stockRow(samosa.id);
    expect(stock.reserved).toBe(10);
    const sold = await prisma.orderLine.aggregate({ where: { itemId: samosa.id }, _sum: { quantity: true } });
    expect(sold._sum.quantity).toBe(10);
  });

  it("multi-unit orders racing never exceed stock either", async () => {
    const vada = await fx.item({ dailyQuantity: 7 });
    const students = await fx.students(12);
    const slot = fx.slot(1);
    await Promise.allSettled(
      students.map((s, i) =>
        placeOrder(s, { lines: [{ itemId: vada.id, quantity: (i % 3) + 1 }], slotStartsAt: slot.startsAt.toISOString() }, NOW),
      ),
    );
    const stock = await stockRow(vada.id);
    const sold = await prisma.orderLine.aggregate({ where: { itemId: vada.id }, _sum: { quantity: true } });
    expect(stock.reserved).toBeLessThanOrEqual(7);
    expect(sold._sum.quantity).toBe(stock.reserved);
  });

  it("a slot never takes more orders than the kitchen capacity", async () => {
    const small = await createFixture({ maxOrdersPerSlot: 5 });
    try {
      const tea = await small.item({ dailyQuantity: 1_000 });
      const students = await small.students(20);
      const slot = small.slot();
      const results = await Promise.allSettled(
        students.map((s) => placeOrder(s, { lines: [{ itemId: tea.id, quantity: 1 }], slotStartsAt: slot.startsAt.toISOString() }, NOW)),
      );
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(5);
      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
      for (const r of rejected) expect((r.reason as { code?: string }).code).toBe("SLOT_FULL");

      const row = await prisma.pickupSlot.findFirstOrThrow({ where: { canteenId: small.canteen.id, startsAt: slot.startsAt } });
      expect(row.booked).toBe(5);
      // A failed slot booking must also give back the stock it reserved first.
      expect((await prisma.dailyStock.findFirstOrThrow({ where: { itemId: tea.id } })).reserved).toBe(5);
    } finally {
      await small.cleanup();
    }
  });

  it("cancelling restores both stock and the slot place", async () => {
    const idli = await fx.item({ dailyQuantity: 3 });
    const [a] = await fx.students(1);
    const slot = fx.slot(2);
    const order = await placeOrder(a, { lines: [{ itemId: idli.id, quantity: 2 }], slotStartsAt: slot.startsAt.toISOString() }, NOW);
    const before = await prisma.pickupSlot.findFirstOrThrow({ where: { canteenId: fx.canteen.id, startsAt: slot.startsAt } });
    expect((await stockRow(idli.id)).reserved).toBe(2);

    await cancelOrder(a, order.id, NOW);
    expect((await stockRow(idli.id)).reserved).toBe(0);
    const after = await prisma.pickupSlot.findFirstOrThrow({ where: { id: before.id } });
    expect(after.booked).toBe(before.booked - 1);
    await expect(cancelOrder(a, order.id, NOW)).rejects.toThrow(/already closed/);
    expect((await stockRow(idli.id)).reserved).toBe(0);
  });

  it("two counters finalising 30 orders at once issue 1..30 with no duplicates and no gaps", async () => {
    const own = await createFixture();
    try {
      const chai = await own.item({ dailyQuantity: 1_000 });
      const students = await own.students(30);
      const slot = own.slot();
      const orders = [];
      for (const s of students) {
        orders.push(await placeOrder(s, { lines: [{ itemId: chai.id, quantity: 1 }], slotStartsAt: slot.startsAt.toISOString() }, NOW));
      }
      // One cancelled order in the middle must not leave a hole.
      await cancelOrder(own.owner, orders[7].id, NOW);
      const toBill = orders.filter((_, i) => i !== 7);

      const counterB = { ...own.counter };
      const results = await Promise.allSettled(
        toBill.map((o, i) => collectOrder(i % 2 === 0 ? own.counter : counterB, o.id, i % 3 === 0 ? "UPI" : "CASH", NOW)),
      );
      expect(results.every((r) => r.status === "fulfilled")).toBe(true);

      const invoices = await prisma.invoice.findMany({ where: { canteenId: own.canteen.id }, orderBy: { seq: "asc" } });
      expect(invoices.map((i) => i.seq)).toEqual(Array.from({ length: 29 }, (_, i) => i + 1));
      expect(new Set(invoices.map((i) => i.number)).size).toBe(29);
      expect(invoices[0].number).toBe("T/2627/00001");
    } finally {
      await own.cleanup();
    }
  });

  it("the same order scanned at two counters at once is billed exactly once", async () => {
    const own = await createFixture();
    try {
      const puff = await own.item();
      const [s] = await own.students(1);
      const order = await placeOrder(s, { lines: [{ itemId: puff.id, quantity: 1 }], slotStartsAt: own.slot().startsAt.toISOString() }, NOW);
      const results = await Promise.allSettled([collectOrder(own.counter, order.id, "CASH", NOW), collectOrder(own.owner, order.id, "UPI", NOW)]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(await prisma.invoice.count({ where: { orderId: order.id } })).toBe(1);
      expect(await prisma.docCounter.findFirst({ where: { canteenId: own.canteen.id } })).toMatchObject({ lastSeq: 1 });
    } finally {
      await own.cleanup();
    }
  });

  it("invoice numbers restart at 1 in a new financial year", async () => {
    const own = await createFixture();
    try {
      const dosa = await own.item({ dailyQuantity: 100 });
      const [s] = await own.students(1);
      const march31 = new Date("2027-03-31T05:30:00Z"); // 11:00 IST, FY 2026-27
      const april1 = new Date("2027-04-01T05:30:00Z"); // 11:00 IST, FY 2027-28
      const bill = async (at: Date) => {
        const startsAt = new Date(at.getTime() + 60 * 60_000).toISOString();
        const o = await placeOrder(s, { lines: [{ itemId: dosa.id, quantity: 1 }], slotStartsAt: startsAt }, at);
        return collectOrder(own.counter, o.id, "CASH", at);
      };
      const a = await bill(march31);
      const b = await bill(march31);
      const c = await bill(april1);
      expect([a.number, b.number, c.number]).toEqual(["T/2627/00001", "T/2627/00002", "T/2728/00001"]);
      expect(isoDate(businessDate(april1))).toBe("2027-04-01");
    } finally {
      await own.cleanup();
    }
  });
});
