import type { Role } from "@/lib/permissions";

/** Who is performing an action. Services take this instead of reading cookies, which keeps them testable. */
export type Actor = { userId: string; role: Role; canteenId: string };
