import "server-only";
import { getCanteenById } from "@/server/canteen";
import type { HeaderCanteen } from "./app-header";

export async function headerCanteen(canteenId: string): Promise<HeaderCanteen> {
  const c = await getCanteenById(canteenId);
  return { name: c.name, isDemo: c.isDemo, logoUrl: c.logoId ? `/api/images/${c.logoId}` : null };
}
