import type { Metadata } from "next";
import { CounterScreen } from "@/components/counter/counter-screen";
import { requireRole } from "@/server/auth";
import { counterQueue } from "@/server/views";

export const metadata: Metadata = { title: "Counter" };

export default async function CounterPage() {
  const user = await requireRole("COUNTER", "OWNER");
  return <CounterScreen initialQueue={{ orders: await counterQueue(user.canteenId) }} />;
}
