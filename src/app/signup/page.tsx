import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";
import { HOME_FOR_ROLE } from "@/lib/permissions";
import { getCurrentUser } from "@/server/auth";
import { getCanteen } from "@/server/canteen";

export const metadata: Metadata = { title: "Create student account" };

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) redirect(HOME_FOR_ROLE[user.role]);
  const canteen = await getCanteen();
  if (!canteen) redirect("/setup");

  return (
    <AuthShell title="Student account" subtitle={`Pre-order from ${canteen.name}. Takes 20 seconds.`}>
      <SignupForm />
    </AuthShell>
  );
}
