import "server-only";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { z } from "zod";
import { assertCan, HOME_FOR_ROLE, type Action, type Role } from "@/lib/permissions";
import type { Actor } from "./actor";
import { prisma } from "./db";
import { UserError } from "./errors";
import { track } from "./usage";

const COOKIE = "ql_session";
const SESSION_DAYS = 30;
const BCRYPT_COST = 11;

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.").max(120);
export const passwordSchema = z.string().min(8, "Use at least 8 characters.").max(72, "Use at most 72 characters.");
export const nameSchema = z.string().trim().min(2, "Enter your name.").max(60);

let dummy: string | null = null;
const dummyHash = () => (dummy ??= bcrypt.hashSync("no-such-user-password", BCRYPT_COST));

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

async function startSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await prisma.session.create({ data: { id: hashToken(token), userId, expiresAt } });
  const jar = await cookies();
  jar.set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: expiresAt });
}

export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { id: hashToken(token) },
    include: { user: { select: { id: true, name: true, email: true, role: true, canteenId: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** For pages: sends visitors to login, and people in the wrong role to their own home. */
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles.length && !roles.includes(user.role)) redirect(HOME_FOR_ROLE[user.role]);
  return user;
}

/** For server actions and API routes: never trust the page that called us. */
export async function requireActor(action?: Action): Promise<Actor> {
  const user = await getCurrentUser();
  if (!user) throw new UserError("Your session expired. Log in again.", "UNAUTHENTICATED");
  if (action) assertCan(user.role, action);
  return { userId: user.id, role: user.role, canteenId: user.canteenId };
}

export async function login(emailInput: string, password: string): Promise<CurrentUser> {
  const email = emailSchema.parse(emailInput);
  const user = await prisma.user.findUnique({ where: { email } });
  // Compare against a dummy hash when the user doesn't exist so timing doesn't reveal which emails are registered.
  const hash = user?.passwordHash ?? dummyHash();
  const ok = await bcrypt.compare(password, hash);
  if (!user || !ok) throw new UserError("That email and password don't match.", "BAD_LOGIN");
  await startSession(user.id);
  await track(prisma, user.canteenId, "LOGIN", user.id);
  return { id: user.id, name: user.name, email: user.email, role: user.role, canteenId: user.canteenId };
}

export async function signupStudent(input: { name: string; email: string; password: string }): Promise<void> {
  const data = z.object({ name: nameSchema, email: emailSchema, password: passwordSchema }).parse(input);
  const canteen = await prisma.canteen.findFirst({ orderBy: { createdAt: "asc" } });
  if (!canteen) throw new UserError("This canteen hasn't been set up yet. Ask the canteen owner to finish setup first.");
  if (await prisma.user.findUnique({ where: { email: data.email } })) {
    throw new UserError("An account with that email already exists. Log in instead.", "EMAIL_TAKEN");
  }
  const user = await prisma.user.create({
    data: { canteenId: canteen.id, name: data.name, email: data.email, passwordHash: await hashPassword(data.password), role: "STUDENT" },
  });
  await startSession(user.id);
  await track(prisma, canteen.id, "SIGNUP", user.id);
}

export async function startSessionFor(userId: string): Promise<void> {
  await startSession(userId);
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { id: hashToken(token) } });
  jar.delete(COOKIE);
}
