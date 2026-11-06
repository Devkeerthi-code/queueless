import type { Metadata } from "next";
import { PageTitle } from "@/components/owner/page-title";
import { StaffManager } from "@/components/owner/staff-manager";
import { requireRole } from "@/server/auth";
import { staffList } from "@/server/owner-views";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage() {
  const user = await requireRole("OWNER");
  const staff = await staffList(user.canteenId);
  return (
    <>
      <PageTitle title="Staff" subtitle="Counter logins can bill and hand over. Kitchen logins see the order board and can mark items out of stock." />
      <StaffManager staff={staff.map(({ createdAt: _c, ...s }) => s)} selfId={user.id} />
    </>
  );
}
