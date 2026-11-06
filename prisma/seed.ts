/**
 * DEMO seed: a clearly labelled demo canteen, menu, staff and three weeks of
 * made-up orders so every report has something to show. Nothing here is real.
 * Re-running replaces the previous demo canteen; it refuses to touch a real one.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { formatDocNumber, type Series } from "../src/lib/doc-number";
import { computeBill } from "../src/lib/gst";
import { gstinChecksum } from "../src/lib/gstin";
import { slotsForDay } from "../src/lib/slots";
import { addDays, businessDate, financialYear, isoDate } from "../src/lib/time";
import { formatToken } from "../src/lib/token";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.replace(/sslmode=require/, "sslmode=verify-full") }) });

const DEMO_DOMAIN = "demo.queueless.in";
const HISTORY_DAYS = 21;

/** Deterministic randomness so every seed run tells the same story. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261106);
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
const id = () => `c${randomBytes(12).toString("hex")}`;

const MENU = [
  { name: "Masala Dosa", category: "Tiffin", isVeg: true, price: 45, cost: 18, qty: 60, prep: 6, weight: 10 },
  { name: "Plain Dosa", category: "Tiffin", isVeg: true, price: 35, cost: 13, qty: 40, prep: 5, weight: 5 },
  { name: "Idli (2 pcs)", category: "Tiffin", isVeg: true, price: 25, cost: 9, qty: 60, prep: 2, weight: 7 },
  { name: "Ven Pongal", category: "Tiffin", isVeg: true, price: 35, cost: 12, qty: 30, prep: 2, weight: 4 },
  { name: "Veg Meals", category: "Meals", isVeg: true, price: 70, cost: 32, qty: 50, prep: 3, weight: 9 },
  { name: "Chicken Biryani", category: "Meals", isVeg: false, price: 110, cost: 55, qty: 35, prep: 4, weight: 8 },
  { name: "Egg Fried Rice", category: "Meals", isVeg: false, price: 80, cost: 34, qty: 30, prep: 7, weight: 4 },
  { name: "Samosa", category: "Snacks", isVeg: true, price: 15, cost: 6, qty: 80, prep: 1, weight: 9 },
  { name: "Veg Puff", category: "Snacks", isVeg: true, price: 20, cost: 8, qty: 40, prep: 1, weight: 5 },
  { name: "Egg Puff", category: "Snacks", isVeg: false, price: 25, cost: 11, qty: 40, prep: 1, weight: 6 },
  { name: "Paneer Roll", category: "Snacks", isVeg: true, price: 60, cost: 26, qty: 25, prep: 5, weight: 3 },
  { name: "Filter Coffee", category: "Drinks", isVeg: true, price: 15, cost: 5, qty: 150, prep: 2, weight: 10 },
  { name: "Masala Tea", category: "Drinks", isVeg: true, price: 12, cost: 4, qty: 150, prep: 2, weight: 8 },
  { name: "Lime Juice", category: "Drinks", isVeg: true, price: 20, cost: 7, qty: 60, prep: 2, weight: 4 },
] as const;

type ItemRow = Prisma.MenuItemCreateManyInput & { id: string; weight: number };

async function removeOldDemo() {
  const existing = await prisma.canteen.findMany({ select: { id: true, isDemo: true, name: true } });
  const real = existing.filter((c) => !c.isDemo);
  if (real.length) throw new Error(`A real canteen ("${real[0].name}") exists. The demo seed never touches real data.`);
  for (const c of existing) {
    await prisma.order.deleteMany({ where: { canteenId: c.id } });
    await prisma.canteen.delete({ where: { id: c.id } });
  }
  await prisma.user.deleteMany({ where: { email: { endsWith: `@${DEMO_DOMAIN}` } } });
}

function demoGstin() {
  // A syntactically valid but made-up GSTIN for Tamil Nadu (33).
  const body = "33AAAAD0000A1Z";
  return body + gstinChecksum(body);
}

async function main() {
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 8) throw new Error("Set DEMO_PASSWORD (8+ characters) in .env before seeding.");
  await removeOldDemo();

  const now = new Date();
  const today = businessDate(now);
  const canteen = await prisma.canteen.create({
    data: {
      name: "DEMO Block C Canteen",
      address: "DEMO DATA - Block C, Sample Engineering College, Coimbatore 641001",
      gstRegistered: true,
      gstin: demoGstin(),
      stateCode: "33",
      invoicePrefix: "QL",
      upiVpa: "demo.canteen@upi",
      openMinute: 8 * 60,
      closeMinute: 17 * 60,
      openDays: [1, 2, 3, 4, 5, 6],
      slotMinutes: 15,
      maxOrdersPerSlot: 12,
      orderCutoffMinutes: 10,
      noShowGraceMinutes: 30,
      noShowThreshold: 2,
      isDemo: true,
    },
  });

  const hash = await bcrypt.hash(password, 11);
  const staff = await Promise.all(
    (["OWNER", "COUNTER", "KITCHEN", "STUDENT"] as const).map((role) =>
      prisma.user.create({
        data: { canteenId: canteen.id, role, passwordHash: hash, email: `${role.toLowerCase()}@${DEMO_DOMAIN}`, name: `Demo ${role[0]}${role.slice(1).toLowerCase()}` },
      }),
    ),
  );
  const [, counter, , demoStudent] = staff;
  const students = [demoStudent.id];
  for (let i = 1; i <= 40; i++) {
    const s = await prisma.user.create({
      data: { canteenId: canteen.id, role: "STUDENT", passwordHash: hash, email: `student${i}@${DEMO_DOMAIN}`, name: `Demo Student ${i}` },
    });
    students.push(s.id);
  }

  const items: ItemRow[] = MENU.map((m) => ({
    id: id(),
    canteenId: canteen.id,
    name: m.name,
    category: m.category,
    isVeg: m.isVeg,
    pricePaise: m.price * 100,
    priceIncludesGst: true,
    gstRateBp: 500,
    hsnSac: "996331",
    costPaise: m.cost * 100,
    dailyQuantity: m.qty,
    prepMinutes: m.prep,
    weight: m.weight,
  }));
  // One packaged item billed as goods at a different rate, priced exclusive of GST, to show multi-rate bills.
  items.push({
    id: id(), canteenId: canteen.id, name: "Bottled Soda (300 ml)", category: "Drinks", isVeg: true, pricePaise: 3_400, priceIncludesGst: false,
    gstRateBp: 1_800, hsnSac: "22021010", costPaise: 2_200, dailyQuantity: 48, prepMinutes: 0, weight: 3,
  });
  await prisma.menuItem.createMany({ data: items.map(({ weight: _w, ...row }) => row) });

  const weighted = items.flatMap((i) => Array.from({ length: i.weight }, () => i));
  const docSeq = new Map<string, number>();
  const nextDoc = (series: Series, at: Date) => {
    const fy = financialYear(at);
    const key = `${series}:${fy}`;
    const seq = (docSeq.get(key) ?? 0) + 1;
    docSeq.set(key, seq);
    return { fy, seq, number: formatDocNumber(canteen.invoicePrefix, series, fy, seq) };
  };

  const orders: Prisma.OrderCreateManyInput[] = [];
  const lines: Prisma.OrderLineCreateManyInput[] = [];
  const invoices: Prisma.InvoiceCreateManyInput[] = [];
  const invoiceLines: Prisma.InvoiceLineCreateManyInput[] = [];
  const slots: Prisma.PickupSlotCreateManyInput[] = [];
  const stock = new Map<string, number>();
  const tokens: Prisma.TokenCounterCreateManyInput[] = [];

  function addOrder(opts: { day: Date; slot: { id: string; startsAt: Date; endsAt: Date } | null; userId: string | null; status: string; placedAt: Date; seq: number }) {
    const orderId = id();
    const chosen = new Map<string, number>();
    for (let n = between(1, 3); n > 0; n--) {
      const item = pick(weighted);
      chosen.set(item.id, (chosen.get(item.id) ?? 0) + (rand() < 0.2 ? 2 : 1));
    }
    const orderLines = [...chosen.entries()].map(([itemId, quantity]) => {
      const item = items.find((i) => i.id === itemId)!;
      return {
        id: id(), orderId, itemId, name: item.name, isVeg: item.isVeg, quantity, unitPricePaise: item.pricePaise,
        priceIncludesGst: item.priceIncludesGst ?? true, gstRateBp: item.gstRateBp, hsnSac: item.hsnSac, costPaise: item.costPaise,
      };
    });
    const bill = computeBill(orderLines.map((l) => ({ key: l.id, name: l.name, hsnSac: l.hsnSac, quantity: l.quantity, unitPricePaise: l.unitPricePaise, priceIncludesGst: l.priceIncludesGst, gstRateBp: l.gstRateBp })), "INTRA_STATE");

    const s = opts.status;
    const started = ["PREPARING", "READY", "COLLECTED"].includes(s) || (s === "NO_SHOW" && rand() < 0.5);
    const handedAt = opts.slot ? new Date(opts.slot.startsAt.getTime() + between(0, 14) * 60_000) : new Date(opts.placedAt.getTime() + 60_000);
    const billed = s === "COLLECTED" || (opts.userId === null && s !== "CANCELLED");
    const mode = rand() < 0.62 ? "UPI" : "CASH";

    orders.push({
      id: orderId, canteenId: canteen.id, userId: opts.userId, source: opts.userId ? "ONLINE" : "WALK_IN", businessDate: opts.day,
      tokenSeq: opts.seq, token: formatToken(opts.seq), slotId: opts.slot?.id ?? null, status: s as Prisma.OrderCreateManyInput["status"],
      estimatePaise: bill.totalPaise, placedAt: opts.placedAt,
      paymentMode: billed ? mode : null, paidAt: billed ? handedAt : null,
      preparingAt: started ? new Date(handedAt.getTime() - 8 * 60_000) : null,
      readyAt: started && s !== "PREPARING" ? new Date(handedAt.getTime() - 2 * 60_000) : null,
      collectedAt: s === "COLLECTED" ? handedAt : null,
      cancelledAt: s === "CANCELLED" ? new Date(opts.placedAt.getTime() + 5 * 60_000) : null,
      noShowAt: s === "NO_SHOW" ? new Date(handedAt.getTime() + 45 * 60_000) : null,
      stockReleased: s === "CANCELLED",
    });
    lines.push(...orderLines);

    if (opts.day.getTime() === today.getTime() && s !== "CANCELLED") {
      for (const l of orderLines) stock.set(l.itemId, (stock.get(l.itemId) ?? 0) + l.quantity);
    }
    if (!billed) return;
    const doc = nextDoc("INV", handedAt);
    const invoiceId = id();
    invoices.push({
      id: invoiceId, canteenId: canteen.id, orderId, series: "INV", financialYear: doc.fy, seq: doc.seq, number: doc.number, issuedAt: handedAt,
      issuedById: counter.id, paymentMode: mode, supplierState: "33", placeOfSupply: "33", isInterState: false,
      taxablePaise: bill.taxablePaise, cgstPaise: bill.cgstPaise, sgstPaise: bill.sgstPaise, igstPaise: 0, roundOffPaise: bill.roundOffPaise, totalPaise: bill.totalPaise,
    });
    bill.lines.forEach((l) => {
      const src = orderLines.find((o) => o.id === l.key)!;
      invoiceLines.push({
        id: id(), invoiceId, itemId: src.itemId, name: l.name, hsnSac: l.hsnSac, quantity: l.quantity, unitPricePaise: l.unitPricePaise, gstRateBp: l.gstRateBp,
        costPaise: src.costPaise, taxablePaise: l.taxablePaise, cgstPaise: l.cgstPaise, sgstPaise: l.sgstPaise, igstPaise: 0, totalPaise: l.totalPaise,
      });
    });
  }

  // Lunch is the rush: weight 12:15-13:45 heavily, with a smaller 10:30 tea-break bump.
  const slotWeight = (minute: number) => (minute >= 735 && minute < 825 ? 9 : minute >= 630 && minute < 675 ? 4 : 1);

  for (let back = HISTORY_DAYS; back >= 0; back--) {
    const day = addDays(today, -back);
    const windows = slotsForDay(day, canteen);
    if (windows.length === 0) continue;
    const isToday = back === 0;
    const booked = new Map<string, number>();
    const daySlots = windows.map((w) => ({ id: id(), startsAt: w.startsAt, endsAt: w.endsAt, minute: w.startMinute }));
    const pool = daySlots.flatMap((s) => Array.from({ length: slotWeight(s.minute) }, () => s));
    let seq = 0;

    const upcoming = (s: { startsAt: Date }) => s.startsAt.getTime() > now.getTime() + 15 * 60_000;
    const target = isToday ? 14 : between(22, 38);
    for (let n = 0; n < target; n++) {
      let slot = pick(pool);
      if (isToday) {
        const future = daySlots.filter(upcoming);
        if (future.length === 0) break;
        slot = future[Math.min(future.length - 1, Math.floor(rand() * Math.min(future.length, 8)))];
      }
      if ((booked.get(slot.id) ?? 0) >= canteen.maxOrdersPerSlot) continue;
      booked.set(slot.id, (booked.get(slot.id) ?? 0) + 1);
      const r = rand();
      const status = isToday ? pick(["PLACED", "PLACED", "PREPARING", "READY"]) : r < 0.86 ? "COLLECTED" : r < 0.93 ? "NO_SHOW" : "CANCELLED";
      // The demo student only ever collects, so they aren't flagged for pre-payment.
      const userId = status === "NO_SHOW" ? pick(students.slice(1)) : pick(students);
      const placedAt = new Date(slot.startsAt.getTime() - between(20, 120) * 60_000);
      addOrder({ day, slot, userId, status, placedAt: isToday && placedAt > now ? now : placedAt, seq: ++seq });
      if (status === "CANCELLED") booked.set(slot.id, booked.get(slot.id)! - 1);
    }
    for (let w = isToday ? 2 : between(4, 9); w > 0; w--) {
      const at = isToday ? new Date(now.getTime() - between(5, 90) * 60_000) : new Date(pick(daySlots).startsAt.getTime() + between(0, 10) * 60_000);
      addOrder({ day, slot: null, userId: null, status: isToday ? "PLACED" : "COLLECTED", placedAt: at, seq: ++seq });
    }
    tokens.push({ canteenId: canteen.id, businessDate: day, lastSeq: seq });
    for (const s of daySlots) {
      if (booked.has(s.id) || orders.some((o) => o.slotId === s.id)) {
        slots.push({ id: s.id, canteenId: canteen.id, startsAt: s.startsAt, endsAt: s.endsAt, capacity: canteen.maxOrdersPerSlot, booked: booked.get(s.id) ?? 0 });
      }
    }
  }

  await prisma.pickupSlot.createMany({ data: slots });
  await prisma.order.createMany({ data: orders });
  await prisma.orderLine.createMany({ data: lines });
  await prisma.invoice.createMany({ data: invoices });
  await prisma.invoiceLine.createMany({ data: invoiceLines });
  await prisma.tokenCounter.createMany({ data: tokens });
  await prisma.docCounter.createMany({
    data: [...docSeq.entries()].map(([key, lastSeq]) => {
      const [series, fy] = key.split(":");
      return { canteenId: canteen.id, series: series as Series, financialYear: fy, lastSeq };
    }),
  });
  await prisma.dailyStock.createMany({
    data: items.map((i) => ({ itemId: i.id, businessDate: today, capacity: i.dailyQuantity, reserved: Math.min(i.dailyQuantity, stock.get(i.id) ?? 0) })),
  });
  // Make one item nearly sold out and one switched off, so those states are visible straight away.
  const samosa = items.find((i) => i.name === "Samosa")!;
  await prisma.dailyStock.update({ where: { itemId_businessDate: { itemId: samosa.id, businessDate: today } }, data: { reserved: samosa.dailyQuantity - 5 } });
  await prisma.menuItem.update({ where: { id: items.find((i) => i.name === "Paneer Roll")!.id }, data: { isAvailable: false } });

  await prisma.usageEvent.createMany({
    data: orders.filter((o) => o.userId).map((o) => ({ canteenId: canteen.id, type: "ORDER_PLACED", userId: o.userId, createdAt: o.placedAt as Date })),
  });

  console.log(`DEMO canteen seeded: ${items.length} items, ${orders.length} orders, ${invoices.length} invoices over ${HISTORY_DAYS + 1} days (up to ${isoDate(today)}).`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
