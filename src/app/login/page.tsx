import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { DemoAccounts } from "@/components/auth/demo-accounts";
import { LoginForm } from "@/components/auth/login-form";
import { HOME_FOR_ROLE } from "@/lib/permissions";
import { getCurrentUser } from "@/server/auth";
import { getCanteen } from "@/server/canteen";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const user = await getCurrentUser();
  if (user) redirect(HOME_FOR_ROLE[user.role]);
  const canteen = await getCanteen();
  if (!canteen) redirect("/setup");
  const { email } = await searchParams;
  const loginEmail = typeof email === "string" ? email.slice(0, 120) : "";
  const demoPassword = canteen.isDemo ? (process.env.DEMO_PASSWORD ?? "") : "";

  return (
    <AuthShell
      title="Log in"
      subtitle={`Students and staff of ${canteen.name} use the same login.`}
      after={demoPassword ? <DemoAccounts password={demoPassword} headingId="demo" /> : undefined}
    >
      <LoginForm key={loginEmail} initialEmail={loginEmail} demoPassword={demoPassword} />
    </AuthShell>
  );
}
