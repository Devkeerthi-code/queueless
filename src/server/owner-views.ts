import "server-only";
import { businessDate, isoDate, toHhMm } from "@/lib/time";
import { prisma } from "./db";
import { listMenu } from "./menu";
import {
  dailySales, demandForecast, gstSummary, itemPerformance, lastNDays, monthOf, noShowStats, slotHeatmap, usageCounts, wastedItems, type Range,
} from "./reports";

/** The owner's dashboard: today at a glance plus the reports for a chosen range. */
export async function ownerOverview(canteenId: string, range: Range, now = new Date()) {
  const today = { from: businessDate(now), to: businessDate(now) };
  const month = monthOf(now);
  const [todaySales, todayNoShows, todayOrders, sales, gst, items, heatmap, noShows, waste, usage] = await Promise.all([
    dailySales(canteenId, today),
    noShowStats(canteenId, today),
    prisma.order.count({ where: { canteenId, businessDate: today.from, status: { not: "CANCELLED" } } }),
    dailySales(canteenId, range),
    gstSummary(canteenId, month),
    itemPerformance(canteenId, range),
    slotHeatmap(canteenId, range),
    noShowStats(canteenId, range),
    wastedItems(canteenId, range),
    usageCounts(canteenId),
  ]);
  const t = todaySales[0];
  return {
    range: { from: isoDate(range.from), to: isoDate(range.to) },
    month: { from: isoDate(month.from), to: isoDate(month.to), label: new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(month.from) },
    today: {
      salesPaise: t?.salesPaise ?? 0,
      profitPaise: t?.profitPaise ?? 0,
      invoices: t?.invoices ?? 0,
      orders: todayOrders,
      noShows: todayNoShows.noShows,
      wastedUnits: todayNoShows.wastedUnits,
    },
    sales,
    gst,
    items,
    heatmap,
    noShows,
    waste,
    usage,
  };
}

export type OwnerOverview = Awaited<ReturnType<typeof ownerOverview>>;

export function defaultRange(now = new Date()): Range {
  return lastNDays(now, 30);
}

export async function ownerMenu(canteenId: string, now = new Date()) {
  const [items, forecast] = await Promise.all([listMenu(canteenId, now), demandForecast(canteenId, now)]);
  return items.map((i) => ({
    id: i.id,
    name: i.name,
    category: i.category,
    isVeg: i.isVeg,
    pricePaise: i.pricePaise,
    priceIncludesGst: i.priceIncludesGst,
    gstRateBp: i.gstRateBp,
    hsnSac: i.hsnSac,
    costPaise: i.costPaise,
    dailyQuantity: i.dailyQuantity,
    prepMinutes: i.prepMinutes,
    isAvailable: i.isAvailable,
    photoUrl: i.photoId ? `/api/images/${i.photoId}` : null,
    remaining: i.remaining,
    suggestedTomorrow: forecast.get(i.id) ?? null,
  }));
}

export type OwnerMenuItem = Awaited<ReturnType<typeof ownerMenu>>[number];

export async function staffList(canteenId: string) {
  return prisma.user.findMany({
    where: { canteenId, role: { in: ["OWNER", "COUNTER", "KITCHEN"] } },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
}

/** Settings form values in the same shape `canteenSchema` accepts. */
export async function canteenFormValues(canteenId: string) {
  const c = await prisma.canteen.findUniqueOrThrow({ where: { id: canteenId } });
  return {
    name: c.name,
    address: c.address,
    gstRegistered: c.gstRegistered,
    gstin: c.gstin ?? "",
    stateCode: c.stateCode,
    invoicePrefix: c.invoicePrefix,
    upiVpa: c.upiVpa ?? "",
    open: toHhMm(c.openMinute),
    close: toHhMm(c.closeMinute),
    openDays: c.openDays,
    slotMinutes: c.slotMinutes,
    maxOrdersPerSlot: c.maxOrdersPerSlot,
    orderCutoffMinutes: c.orderCutoffMinutes,
    noShowGraceMinutes: c.noShowGraceMinutes,
    noShowThreshold: c.noShowThreshold,
    logoUrl: c.logoId ? `/api/images/${c.logoId}` : null,
    isDemo: c.isDemo,
  };
}
