import "server-only";
import QRCode from "qrcode";
import { env } from "@/lib/env";
import { effectiveStatus, isOverdue, type Status } from "@/lib/noshow";
import { signPickupCode } from "@/lib/qr-sign";
import { isOpenNow, isSlotBookable, slotsForDay } from "@/lib/slots";
import { businessDate, formatMinute, istParts } from "@/lib/time";
import { normaliseToken } from "@/lib/token";
import { upiPayLink } from "@/lib/upi";
import { verifyPickupCode } from "@/lib/qr-sign";
import { prisma } from "./db";
import { listMenu } from "./menu";

/* Plain, serialisable shapes the pages and polling endpoints return. Dates are ISO strings. */

export type SlotView = { startsAt: string; label: string; booked: number; capacity: number; full: boolean; bookable: boolean };

export type MenuItemView = {
  id: string;
  name: string;
  category: string;
  isVeg: boolean;
  pricePaise: number;
  priceIncludesGst: boolean;
  gstRateBp: number;
  photoUrl: string | null;
  remaining: number;
  isAvailable: boolean;
  prepMinutes: number;
};

export const LOW_STOCK_AT = 8;

export async function slotViews(canteenId: string, now: Date): Promise<SlotView[]> {
  const canteen = await prisma.canteen.findUniqueOrThrow({ where: { id: canteenId } });
  const day = businessDate(now);
  const windows = slotsForDay(day, canteen);
  const rows = await prisma.pickupSlot.findMany({
    where: { canteenId, startsAt: { in: windows.map((w) => w.startsAt) } },
    select: { startsAt: true, booked: true, capacity: true },
  });
  const byTime = new Map(rows.map((r) => [r.startsAt.getTime(), r]));
  return windows.map((w) => {
    const row = byTime.get(w.startsAt.getTime());
    const capacity = row?.capacity ?? canteen.maxOrdersPerSlot;
    const booked = row?.booked ?? 0;
    return {
      startsAt: w.startsAt.toISOString(),
      label: formatMinute(w.startMinute),
      booked,
      capacity,
      full: booked >= capacity,
      bookable: booked < capacity && isSlotBookable(w.startsAt, now, canteen),
    };
  });
}

export async function menuItemViews(canteenId: string, now: Date): Promise<MenuItemView[]> {
  const items = await listMenu(canteenId, now);
  return items.map((i) => ({
    id: i.id,
    name: i.name,
    category: i.category,
    isVeg: i.isVeg,
    pricePaise: i.pricePaise,
    priceIncludesGst: i.priceIncludesGst,
    gstRateBp: i.gstRateBp,
    photoUrl: i.photoId ? `/api/images/${i.photoId}` : null,
    remaining: i.remaining,
    isAvailable: i.isAvailable,
    prepMinutes: i.prepMinutes,
  }));
}

/** Everything the student menu needs in one round trip. Also used by its polling endpoint. */
export async function studentMenuView(userId: string, canteenId: string, now = new Date()) {
  const canteen = await prisma.canteen.findUniqueOrThrow({ where: { id: canteenId } });
  const [items, slots, lastOrder, favourites, active] = await Promise.all([
    menuItemViews(canteenId, now),
    slotViews(canteenId, now),
    prisma.order.findFirst({
      where: { userId, status: { in: ["COLLECTED", "PLACED", "PREPARING", "READY"] } },
      orderBy: { placedAt: "desc" },
      include: { lines: { select: { itemId: true, name: true, quantity: true } } },
    }),
    prisma.favourite.findMany({ where: { userId }, select: { itemId: true } }),
    activeOrdersFor(userId, now),
  ]);
  return {
    canteen: {
      name: canteen.name,
      isOpen: isOpenNow(now, canteen),
      opensAt: formatMinute(canteen.openMinute),
      closesAt: formatMinute(canteen.closeMinute),
      isDemo: canteen.isDemo,
      cutoffMinutes: canteen.orderCutoffMinutes,
      logoUrl: canteen.logoId ? `/api/images/${canteen.logoId}` : null,
    },
    items,
    slots,
    usual: lastOrder ? lastOrder.lines.map((l) => ({ itemId: l.itemId, name: l.name, quantity: l.quantity })) : [],
    favouriteIds: favourites.map((f) => f.itemId),
    activeOrders: active,
  };
}

export type StudentMenuView = Awaited<ReturnType<typeof studentMenuView>>;

async function activeOrdersFor(userId: string, now: Date) {
  const orders = await prisma.order.findMany({
    where: { userId, businessDate: businessDate(now), status: { in: ["PLACED", "PREPARING", "READY"] } },
    include: { slot: true, canteen: { select: { noShowGraceMinutes: true } } },
    orderBy: { placedAt: "desc" },
  });
  return orders
    .filter((o) => effectiveStatus(o.status as Status, o.slot?.endsAt ?? null, now, o.canteen.noShowGraceMinutes) !== "NO_SHOW")
    .map((o) => ({ id: o.id, token: o.token, status: o.status, slotLabel: o.slot ? formatMinute(istParts(o.slot.startsAt).minuteOfDay) : null }));
}

/** The student's token slip. Returns null if it isn't their order. */
export async function orderView(orderId: string, viewer: { userId: string; role: string; canteenId: string }, now = new Date()) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, canteenId: viewer.canteenId, ...(viewer.role === "STUDENT" ? { userId: viewer.userId } : {}) },
    include: { lines: true, slot: true, invoice: { select: { id: true, number: true, totalPaise: true } }, canteen: true },
  });
  if (!order) return null;
  const status = effectiveStatus(order.status as Status, order.slot?.endsAt ?? null, now, order.canteen.noShowGraceMinutes);
  const code = signPickupCode(env().QR_SECRET, order.id);
  const payable = order.invoice?.totalPaise ?? order.estimatePaise;
  return {
    id: order.id,
    token: order.token,
    status,
    requiresPrepay: order.requiresPrepay,
    paid: order.paidAt !== null,
    placedAt: order.placedAt.toISOString(),
    slot: order.slot
      ? { label: formatMinute(istParts(order.slot.startsAt).minuteOfDay), endsLabel: formatMinute(istParts(order.slot.endsAt).minuteOfDay), startsAt: order.slot.startsAt.toISOString() }
      : null,
    lines: order.lines.map((l) => ({ name: l.name, quantity: l.quantity, isVeg: l.isVeg, unitPricePaise: l.unitPricePaise })),
    estimatePaise: order.estimatePaise,
    invoice: order.invoice,
    canCancel: order.status === "PLACED" && status === "PLACED" && !order.invoice,
    qrSvg: await QRCode.toString(code, { type: "svg", margin: 1, errorCorrectionLevel: "M" }),
    upiLink: order.canteen.upiVpa ? upiPayLink({ vpa: order.canteen.upiVpa, payeeName: order.canteen.name, amountPaise: payable, note: `Token ${order.token}` }) : null,
    canteenName: order.canteen.name,
    timeline: {
      placedAt: order.placedAt.toISOString(),
      preparingAt: order.preparingAt?.toISOString() ?? null,
      readyAt: order.readyAt?.toISOString() ?? null,
      collectedAt: order.collectedAt?.toISOString() ?? null,
    },
  };
}

export type OrderView = NonNullable<Awaited<ReturnType<typeof orderView>>>;

export async function studentHistory(userId: string, now = new Date()) {
  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { placedAt: "desc" },
    take: 30,
    include: { lines: { select: { name: true, quantity: true } }, slot: true, canteen: { select: { noShowGraceMinutes: true } }, invoice: { select: { totalPaise: true } } },
  });
  return orders.map((o) => ({
    id: o.id,
    token: o.token,
    placedAt: o.placedAt.toISOString(),
    status: effectiveStatus(o.status as Status, o.slot?.endsAt ?? null, now, o.canteen.noShowGraceMinutes),
    summary: o.lines.map((l) => `${l.quantity}× ${l.name}`).join(", "),
    totalPaise: o.invoice?.totalPaise ?? o.estimatePaise,
  }));
}

export type KitchenOrder = {
  id: string;
  token: string;
  status: "PLACED" | "PREPARING" | "READY";
  source: "ONLINE" | "WALK_IN";
  placedAt: string;
  payFirst: boolean;
  lines: { name: string; quantity: number; isVeg: boolean }[];
};

export type KitchenColumn = { key: string; label: string; startsAt: string | null; orders: KitchenOrder[] };

/** Today's open orders grouped by pickup slot (walk-ins first), oldest first. Overdue orders drop off. */
export async function kitchenView(canteenId: string, now = new Date()): Promise<KitchenColumn[]> {
  const canteen = await prisma.canteen.findUniqueOrThrow({ where: { id: canteenId } });
  const orders = await prisma.order.findMany({
    where: { canteenId, businessDate: businessDate(now), status: { in: ["PLACED", "PREPARING", "READY"] } },
    include: { lines: { select: { name: true, quantity: true, isVeg: true } }, slot: true },
    orderBy: { placedAt: "asc" },
  });
  const columns = new Map<string, KitchenColumn>();
  for (const o of orders) {
    if (isOverdue(o.slot?.endsAt ?? null, now, canteen.noShowGraceMinutes)) continue;
    const key = o.slot ? o.slot.startsAt.toISOString() : "walk-in";
    const col = columns.get(key) ?? {
      key,
      label: o.slot ? formatMinute(istParts(o.slot.startsAt).minuteOfDay) : "Walk-in",
      startsAt: o.slot?.startsAt.toISOString() ?? null,
      orders: [],
    };
    col.orders.push({
      id: o.id,
      token: o.token,
      status: o.status as KitchenOrder["status"],
      source: o.source,
      placedAt: o.placedAt.toISOString(),
      payFirst: o.requiresPrepay && !o.paidAt,
      lines: o.lines,
    });
    columns.set(key, col);
  }
  return [...columns.values()].sort((a, b) => (a.startsAt ?? "").localeCompare(b.startsAt ?? ""));
}

export type CounterOrder = {
  id: string;
  token: string;
  status: Status;
  dbStatus: Status;
  studentName: string | null;
  slotLabel: string | null;
  payFirst: boolean;
  paid: boolean;
  invoice: { id: string; number: string; totalPaise: number } | null;
  estimatePaise: number;
  lines: { name: string; quantity: number; isVeg: boolean; unitPricePaise: number }[];
};

/** Finds today's order from a scanned QR (signature checked) or a typed token. */
export async function counterLookup(canteenId: string, query: { code?: string; token?: string }, now = new Date()): Promise<CounterOrder | null> {
  let where: { id: string } | { token: string; businessDate: Date };
  if (query.code) {
    const id = verifyPickupCode(env().QR_SECRET, query.code);
    if (!id) return null;
    where = { id };
  } else if (query.token) {
    where = { token: normaliseToken(query.token), businessDate: businessDate(now) };
  } else return null;

  const order = await prisma.order.findFirst({
    where: { canteenId, ...where },
    include: { lines: true, slot: true, user: { select: { name: true } }, invoice: { select: { id: true, number: true, totalPaise: true } }, canteen: true },
  });
  if (!order) return null;
  return {
    id: order.id,
    token: order.token,
    status: effectiveStatus(order.status as Status, order.slot?.endsAt ?? null, now, order.canteen.noShowGraceMinutes),
    dbStatus: order.status as Status,
    studentName: order.user?.name ?? null,
    slotLabel: order.slot ? formatMinute(istParts(order.slot.startsAt).minuteOfDay) : null,
    payFirst: order.requiresPrepay && !order.paidAt,
    paid: order.paidAt !== null,
    invoice: order.invoice,
    estimatePaise: order.estimatePaise,
    lines: order.lines.map((l) => ({ name: l.name, quantity: l.quantity, isVeg: l.isVeg, unitPricePaise: l.unitPricePaise })),
  };
}

/** Orders waiting at the counter right now: ready ones first. */
export async function counterQueue(canteenId: string, now = new Date()) {
  const canteen = await prisma.canteen.findUniqueOrThrow({ where: { id: canteenId } });
  const orders = await prisma.order.findMany({
    where: { canteenId, businessDate: businessDate(now), status: { in: ["PLACED", "PREPARING", "READY"] } },
    include: { slot: true },
    orderBy: [{ readyAt: "asc" }, { placedAt: "asc" }],
  });
  return orders
    .filter((o) => !isOverdue(o.slot?.endsAt ?? null, now, canteen.noShowGraceMinutes))
    .map((o) => ({ id: o.id, token: o.token, status: o.status, payFirst: o.requiresPrepay && !o.paidAt }))
    .sort((a, b) => Number(b.status === "READY") - Number(a.status === "READY"));
}

export async function invoiceList(canteenId: string, opts: { q?: string; take?: number } = {}) {
  const q = opts.q?.trim();
  const invoices = await prisma.invoice.findMany({
    where: { canteenId, ...(q ? { OR: [{ number: { contains: q, mode: "insensitive" } }, { order: { token: normaliseToken(q) } }] } : {}) },
    orderBy: { issuedAt: "desc" },
    take: opts.take ?? 50,
    include: { order: { select: { token: true, source: true } }, creditNotes: { select: { totalPaise: true } } },
  });
  return invoices.map((i) => ({
    id: i.id,
    number: i.number,
    issuedAt: i.issuedAt.toISOString(),
    token: i.order.token,
    source: i.order.source,
    paymentMode: i.paymentMode,
    totalPaise: i.totalPaise,
    creditedPaise: i.creditNotes.reduce((s, c) => s + c.totalPaise, 0),
  }));
}

export async function invoiceDetail(canteenId: string, invoiceId: string) {
  const inv = await prisma.invoice.findFirst({
    where: { id: invoiceId, canteenId },
    include: {
      lines: { include: { creditLines: { select: { quantity: true } } } },
      order: { select: { token: true, preparingAt: true, businessDate: true, status: true } },
      creditNotes: { orderBy: { issuedAt: "asc" }, select: { id: true, number: true, issuedAt: true, totalPaise: true, reason: true } },
    },
  });
  if (!inv) return null;
  const today = businessDate(new Date());
  return {
    id: inv.id,
    number: inv.number,
    series: inv.series,
    issuedAt: inv.issuedAt.toISOString(),
    token: inv.order.token,
    paymentMode: inv.paymentMode,
    totalPaise: inv.totalPaise,
    taxablePaise: inv.taxablePaise,
    taxPaise: inv.cgstPaise + inv.sgstPaise + inv.igstPaise,
    canRestock: inv.order.preparingAt === null && inv.order.businessDate.getTime() === today.getTime(),
    lines: inv.lines.map((l) => ({
      id: l.id,
      name: l.name,
      quantity: l.quantity,
      refundable: l.quantity - l.creditLines.reduce((s, c) => s + c.quantity, 0),
      totalPaise: l.totalPaise,
      unitPricePaise: l.unitPricePaise,
      gstRateBp: l.gstRateBp,
    })),
    creditNotes: inv.creditNotes.map((c) => ({ ...c, issuedAt: c.issuedAt.toISOString() })),
  };
}
