import { randomBytes } from "node:crypto";
import type { Actor } from "@/server/actor";
import { prisma } from "@/server/db";
import { slotsForDay } from "@/lib/slots";
import { businessDate } from "@/lib/time";

// Integration tests use TEST_DATABASE_URL when set, else DATABASE_URL. Each test file
// creates its own throwaway canteen and deletes it afterwards, so real data is never touched.
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

export const hasDatabase = Boolean(process.env.DATABASE_URL);

/** A fixed Friday lunchtime: 11:00 IST on 6 Nov 2026. */
export const NOW = new Date("2026-11-06T05:30:00Z");

/** Order lines restrict item deletion, so orders go first. */
export async function removeCanteen(id: string) {
  await prisma.$transaction([prisma.order.deleteMany({ where: { canteenId: id } }), prisma.canteen.delete({ where: { id } })]);
}

type ItemFields = { name: string; pricePaise: number; priceIncludesGst: boolean; gstRateBp: number; costPaise: number; dailyQuantity: number; isVeg: boolean };

export type Fixture = Awaited<ReturnType<typeof createFixture>>;

export async function createFixture(opts: { gstRegistered?: boolean; maxOrdersPerSlot?: number; stateCode?: string } = {}) {
  const tag = randomBytes(4).toString("hex");
  const canteen = await prisma.canteen.create({
    data: {
      name: `TEST canteen ${tag}`,
      address: "Test block",
      gstRegistered: opts.gstRegistered ?? true,
      gstin: opts.gstRegistered === false ? null : "33ABCDE1234F1Z5",
      stateCode: opts.stateCode ?? "33",
      invoicePrefix: "T",
      openMinute: 11 * 60,
      closeMinute: 15 * 60,
      openDays: [0, 1, 2, 3, 4, 5, 6],
      slotMinutes: 15,
      maxOrdersPerSlot: opts.maxOrdersPerSlot ?? 500,
      orderCutoffMinutes: 10,
      noShowGraceMinutes: 30,
      noShowThreshold: 2,
    },
  });

  const mkUser = (role: Actor["role"], i = 0) =>
    prisma.user.create({ data: { canteenId: canteen.id, email: `${role.toLowerCase()}${i}-${tag}@test.local`, name: `${role} ${i}`, passwordHash: "x", role } });

  const [owner, counter, kitchen] = await Promise.all([mkUser("OWNER"), mkUser("COUNTER"), mkUser("KITCHEN")]);
  const actor = (u: { id: string; role: Actor["role"] }): Actor => ({ userId: u.id, role: u.role, canteenId: canteen.id });

  let studentCount = 0;
  const students = async (n: number) => {
    const start = studentCount;
    studentCount += n;
    const users = await Promise.all(Array.from({ length: n }, (_, i) => mkUser("STUDENT", start + i + 1)));
    return users.map(actor);
  };

  const item = (over: Partial<ItemFields> = {}) =>
    prisma.menuItem.create({
      data: {
        canteenId: canteen.id,
        name: `Samosa ${randomBytes(3).toString("hex")}`,
        category: "Snacks",
        isVeg: true,
        pricePaise: 1_500,
        priceIncludesGst: true,
        gstRateBp: 500,
        hsnSac: "996331",
        costPaise: 600,
        dailyQuantity: 100,
        prepMinutes: 2,
        ...over,
      },
    });

  /** First slot that's still bookable at NOW. */
  const slot = (index = 0) => {
    const slots = slotsForDay(businessDate(NOW), canteen).filter((s) => s.startsAt.getTime() - 10 * 60_000 >= NOW.getTime());
    return slots[index];
  };

  return {
    canteen,
    owner: actor(owner),
    counter: actor(counter),
    kitchen: actor(kitchen),
    students,
    item,
    slot,
    cleanup: () => removeCanteen(canteen.id),
  };
}
