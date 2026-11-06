import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { HOME_FOR_ROLE } from "@/lib/permissions";
import { getCurrentUser } from "@/server/auth";
import { getCanteen } from "@/server/canteen";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(HOME_FOR_ROLE[user.role]);
  const canteen = await getCanteen();
  if (!canteen) redirect("/setup");

  return (
    <AuthShell title="Log in" subtitle={`Students and staff of ${canteen.name} use the same login.`}>
      <LoginForm />
    </AuthShell>
  );
}
