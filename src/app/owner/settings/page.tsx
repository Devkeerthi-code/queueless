import type { Metadata } from "next";
import { PageTitle } from "@/components/owner/page-title";
import { SettingsForm } from "@/components/owner/settings-form";
import { requireRole } from "@/server/auth";
import { canteenFormValues } from "@/server/owner-views";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireRole("OWNER");
  const { logoUrl, isDemo: _demo, ...values } = await canteenFormValues(user.canteenId);
  return (
    <>
      <PageTitle title="Settings" subtitle="What's printed on bills, and how pickup slots work." />
      <SettingsForm values={values} logoUrl={logoUrl} />
    </>
  );
}
