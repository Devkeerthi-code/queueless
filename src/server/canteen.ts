import "server-only";
import { z } from "zod";
import { INVOICE_PREFIX_PATTERN } from "@/lib/doc-number";
import { GST_STATES, validateGstin } from "@/lib/gstin";
import { assertCan } from "@/lib/permissions";
import { parseHhMm } from "@/lib/time";
import { isValidVpa } from "@/lib/upi";
import type { Actor } from "./actor";
import { emailSchema, hashPassword, nameSchema, passwordSchema, startSessionFor } from "./auth";
import { prisma } from "./db";
import { UserError } from "./errors";
import { saveImage } from "./images";

const hhmm = (label: string) =>
  z.string().refine((v) => parseHhMm(v) !== null, `${label} must be a time like 12:30.`).transform((v) => parseHhMm(v)!);

export const canteenSchema = z
  .object({
    name: z.string().trim().min(2, "Enter the canteen's name.").max(80),
    address: z.string().trim().min(5, "Enter the address printed on bills.").max(200),
    gstRegistered: z.boolean(),
    gstin: z.string().trim().toUpperCase().max(15).optional().default(""),
    stateCode: z.string().refine((s) => s in GST_STATES, "Pick the state the canteen is in."),
    invoicePrefix: z.string().trim().toUpperCase().regex(INVOICE_PREFIX_PATTERN, "Use 1 to 4 letters or digits, e.g. QL."),
    upiVpa: z.string().trim().max(100).optional().default(""),
    open: hhmm("Opening time"),
    close: hhmm("Closing time"),
    openDays: z.array(z.number().int().min(0).max(6)).min(1, "Pick at least one day.").max(7),
    slotMinutes: z.number().int().min(5).max(60),
    maxOrdersPerSlot: z.number().int().min(1).max(500),
    orderCutoffMinutes: z.number().int().min(0).max(120),
    noShowGraceMinutes: z.number().int().min(5).max(240),
    noShowThreshold: z.number().int().min(0).max(10),
  })
  .superRefine((v, ctx) => {
    if (v.close <= v.open) ctx.addIssue({ code: "custom", path: ["close"], message: "Closing time must be after opening time." });
    if (v.close - v.open < v.slotMinutes) ctx.addIssue({ code: "custom", path: ["slotMinutes"], message: "Opening hours are shorter than one slot." });
    if (v.upiVpa && !isValidVpa(v.upiVpa)) ctx.addIssue({ code: "custom", path: ["upiVpa"], message: "That doesn't look like a UPI ID (name@bank)." });
    if (v.gstRegistered) {
      const check = validateGstin(v.gstin);
      if (!check.ok) ctx.addIssue({ code: "custom", path: ["gstin"], message: check.reason });
      else if (check.stateCode !== v.stateCode) {
        ctx.addIssue({ code: "custom", path: ["stateCode"], message: `This GSTIN is registered in ${GST_STATES[check.stateCode]}. Pick that state.` });
      }
    }
  });

export type CanteenInput = z.input<typeof canteenSchema>;

function toRow(v: z.output<typeof canteenSchema>) {
  return {
    name: v.name,
    address: v.address,
    gstRegistered: v.gstRegistered,
    gstin: v.gstRegistered ? v.gstin : null,
    stateCode: v.stateCode,
    invoicePrefix: v.invoicePrefix,
    upiVpa: v.upiVpa || null,
    openMinute: v.open,
    closeMinute: v.close,
    openDays: [...new Set(v.openDays)].sort(),
    slotMinutes: v.slotMinutes,
    maxOrdersPerSlot: v.maxOrdersPerSlot,
    orderCutoffMinutes: v.orderCutoffMinutes,
    noShowGraceMinutes: v.noShowGraceMinutes,
    noShowThreshold: v.noShowThreshold,
  };
}

export async function getCanteen() {
  return prisma.canteen.findFirst({ orderBy: { createdAt: "asc" } });
}

export async function getCanteenById(id: string) {
  return prisma.canteen.findUniqueOrThrow({ where: { id } });
}

/** First-run setup: creates the canteen and its owner together. Only allowed while no canteen exists. */
export async function setupCanteen(input: { canteen: unknown; owner: unknown }, logo?: File | null) {
  const canteen = canteenSchema.parse(input.canteen);
  const owner = z.object({ name: nameSchema, email: emailSchema, password: passwordSchema }).parse(input.owner);
  if (await getCanteen()) throw new UserError("This canteen is already set up. Log in as the owner.");
  const passwordHash = await hashPassword(owner.password);
  const logoId = logo && logo.size > 0 ? await saveImage(logo) : null;

  const created = await prisma.$transaction(async (tx) => {
    if (await tx.canteen.findFirst()) throw new UserError("This canteen is already set up. Log in as the owner.");
    const c = await tx.canteen.create({ data: { ...toRow(canteen), logoId } });
    return tx.user.create({ data: { canteenId: c.id, name: owner.name, email: owner.email, passwordHash, role: "OWNER" } });
  });
  await startSessionFor(created.id);
}

export async function updateCanteen(actor: Actor, input: unknown, logo?: File | null) {
  assertCan(actor.role, "canteen:edit");
  const data = canteenSchema.parse(input);
  const logoId = logo && logo.size > 0 ? await saveImage(logo) : undefined;
  await prisma.canteen.update({ where: { id: actor.canteenId }, data: { ...toRow(data), ...(logoId ? { logoId } : {}) } });
}

export const staffSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(["COUNTER", "KITCHEN"]),
});

export async function addStaff(actor: Actor, input: unknown) {
  assertCan(actor.role, "staff:manage");
  const data = staffSchema.parse(input);
  if (await prisma.user.findUnique({ where: { email: data.email } })) throw new UserError("Someone already uses that email.");
  await prisma.user.create({
    data: { canteenId: actor.canteenId, name: data.name, email: data.email, role: data.role, passwordHash: await hashPassword(data.password) },
  });
}

export async function removeStaff(actor: Actor, userId: string) {
  assertCan(actor.role, "staff:manage");
  const { count } = await prisma.user.deleteMany({ where: { id: userId, canteenId: actor.canteenId, role: { in: ["COUNTER", "KITCHEN"] } } });
  if (count === 0) throw new UserError("Staff member not found.");
}
