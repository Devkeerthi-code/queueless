import "server-only";
import { z } from "zod";
import { parseMenuCsv } from "@/lib/menu-csv";
import { assertCan } from "@/lib/permissions";
import { businessDate } from "@/lib/time";
import type { Actor } from "./actor";
import { prisma } from "./db";
import { UserError } from "./errors";
import { saveImage } from "./images";
import { remainingToday, syncTodayCapacity } from "./inventory";
import { track } from "./usage";

export const itemSchema = z.object({
  name: z.string().trim().min(1, "Give the item a name.").max(60),
  category: z.string().trim().min(1, "Pick a category.").max(30),
  isVeg: z.boolean(),
  pricePaise: z.number().int().min(0).max(10_000_00),
  priceIncludesGst: z.boolean(),
  gstRateBp: z.number().int().min(0).max(4000),
  hsnSac: z.string().trim().regex(/^\d{4,8}$/, "HSN/SAC is 4 to 8 digits."),
  costPaise: z.number().int().min(0).max(10_000_00),
  dailyQuantity: z.number().int().min(0).max(10_000),
  prepMinutes: z.number().int().min(0).max(120),
});

async function assertUniqueName(canteenId: string, name: string, exceptId?: string) {
  const clash = await prisma.menuItem.findFirst({
    where: { canteenId, name: { equals: name, mode: "insensitive" }, archivedAt: null, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
  });
  if (clash) throw new UserError(`There's already an item called "${clash.name}".`);
}

export async function createItem(actor: Actor, input: unknown, photo?: File | null) {
  assertCan(actor.role, "menu:edit");
  const data = itemSchema.parse(input);
  await assertUniqueName(actor.canteenId, data.name);
  const photoId = photo && photo.size > 0 ? await saveImage(photo) : null;
  // An archived item with the same name is brought back rather than duplicated.
  const archived = await prisma.menuItem.findFirst({ where: { canteenId: actor.canteenId, name: data.name, archivedAt: { not: null } } });
  if (archived) {
    return prisma.menuItem.update({ where: { id: archived.id }, data: { ...data, archivedAt: null, isAvailable: true, ...(photoId ? { photoId } : {}) } });
  }
  return prisma.menuItem.create({ data: { ...data, canteenId: actor.canteenId, photoId } });
}

export async function updateItem(actor: Actor, itemId: string, input: unknown, photo?: File | null, now = new Date()) {
  assertCan(actor.role, "menu:edit");
  const data = itemSchema.parse(input);
  const existing = await prisma.menuItem.findFirst({ where: { id: itemId, canteenId: actor.canteenId } });
  if (!existing) throw new UserError("Item not found.");
  await assertUniqueName(actor.canteenId, data.name, itemId);
  const photoId = photo && photo.size > 0 ? await saveImage(photo) : undefined;
  await prisma.menuItem.update({ where: { id: itemId }, data: { ...data, ...(photoId ? { photoId } : {}) } });
  await syncTodayCapacity(prisma, itemId, data.dailyQuantity, businessDate(now));
}

/** Items are archived, never deleted, because past invoices point at them. */
export async function archiveItem(actor: Actor, itemId: string) {
  assertCan(actor.role, "menu:edit");
  const { count } = await prisma.menuItem.updateMany({ where: { id: itemId, canteenId: actor.canteenId }, data: { archivedAt: new Date(), isAvailable: false } });
  if (count === 0) throw new UserError("Item not found.");
}

/** The kitchen can do this too: "we've run out of paneer" shouldn't need the owner. */
export async function setAvailability(actor: Actor, itemId: string, isAvailable: boolean) {
  assertCan(actor.role, "menu:toggle-availability");
  const { count } = await prisma.menuItem.updateMany({ where: { id: itemId, canteenId: actor.canteenId, archivedAt: null }, data: { isAvailable } });
  if (count === 0) throw new UserError("Item not found.");
}

export async function importMenuCsv(actor: Actor, text: string, now = new Date()) {
  assertCan(actor.role, "menu:edit");
  const { rows, errors } = parseMenuCsv(text);
  if (errors.length) return { created: 0, updated: 0, errors };

  const existing = await prisma.menuItem.findMany({ where: { canteenId: actor.canteenId }, select: { id: true, name: true } });
  const byName = new Map(existing.map((i) => [i.name.toLowerCase(), i.id]));
  let created = 0;
  let updated = 0;

  await prisma.$transaction(async (tx) => {
    for (const r of rows) {
      const data = {
        name: r.name, category: r.category, isVeg: r.veg, pricePaise: r.price, priceIncludesGst: r.price_includes_gst,
        gstRateBp: r.gst_rate, hsnSac: r.hsn_sac, costPaise: r.cost, dailyQuantity: r.daily_qty, prepMinutes: r.prep_minutes,
      };
      const id = byName.get(r.name.toLowerCase());
      if (id) {
        await tx.menuItem.update({ where: { id }, data: { ...data, archivedAt: null } });
        await syncTodayCapacity(tx, id, r.daily_qty, businessDate(now));
        updated++;
      } else {
        await tx.menuItem.create({ data: { ...data, canteenId: actor.canteenId } });
        created++;
      }
    }
  }, { timeout: 30_000, maxWait: 10_000 });

  await track(prisma, actor.canteenId, "MENU_IMPORTED", actor.userId);
  return { created, updated, errors: [] };
}

export type MenuEntry = Awaited<ReturnType<typeof listMenu>>[number];

/** The live menu with today's remaining stock, in a stable order. */
export async function listMenu(canteenId: string, now = new Date(), opts: { includeArchived?: boolean } = {}) {
  const [items, remaining] = await Promise.all([
    prisma.menuItem.findMany({
      where: { canteenId, ...(opts.includeArchived ? {} : { archivedAt: null }) },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    remainingToday(prisma, canteenId, businessDate(now)),
  ]);
  return items.map((i) => ({ ...i, remaining: remaining.get(i.id) ?? i.dailyQuantity }));
}
