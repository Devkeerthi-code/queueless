"use server";

import { redirect } from "next/navigation";
import { HOME_FOR_ROLE } from "@/lib/permissions";
import { login, logout, signupStudent } from "@/server/auth";
import { setupCanteen } from "@/server/canteen";
import { runAction, type ActionResult } from "@/server/errors";

export async function loginAction(input: { email: string; password: string }): Promise<ActionResult<{ home: string }>> {
  return runAction(async () => {
    const user = await login(input.email, input.password);
    return { home: HOME_FOR_ROLE[user.role] };
  });
}

export async function signupAction(input: { name: string; email: string; password: string }): Promise<ActionResult<{ home: string }>> {
  return runAction(async () => {
    await signupStudent(input);
    return { home: HOME_FOR_ROLE.STUDENT };
  });
}

/** First-run setup. Canteen fields arrive as JSON so the logo file can travel in the same FormData. */
export async function setupAction(form: FormData): Promise<ActionResult<{ home: string }>> {
  return runAction(async () => {
    const canteen = JSON.parse(String(form.get("canteen") ?? "{}")) as unknown;
    const owner = JSON.parse(String(form.get("owner") ?? "{}")) as unknown;
    const logo = form.get("logo");
    await setupCanteen({ canteen, owner }, logo instanceof File ? logo : null);
    return { home: HOME_FOR_ROLE.OWNER };
  });
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect("/login");
}
