import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { SetupWizard } from "@/components/auth/setup-wizard";
import { getCanteen } from "@/server/canteen";

export const metadata: Metadata = { title: "Set up your canteen" };

export default async function SetupPage() {
  await connection();
  if (await getCanteen()) redirect("/login");
  return (
    <AuthShell wide title="Set up your canteen" subtitle="About three minutes. You can change all of this later in Settings.">
      <SetupWizard />
    </AuthShell>
  );
}
