/**
 * Prints honest usage numbers ("Used by N students") from the privacy-respecting
 * UsageEvent table. Demo canteens are reported separately so they never inflate real numbers.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.replace(/sslmode=require/, "sslmode=verify-full") }) });

async function main() {
  const canteens = await prisma.canteen.findMany({ select: { id: true, name: true, isDemo: true } });
  for (const c of canteens) {
    const [students, active, events] = await Promise.all([
      prisma.user.count({ where: { canteenId: c.id, role: "STUDENT" } }),
      prisma.usageEvent.findMany({ where: { canteenId: c.id, type: "ORDER_PLACED" }, distinct: ["userId"], select: { userId: true } }),
      prisma.usageEvent.groupBy({ by: ["type"], where: { canteenId: c.id }, _count: { _all: true } }),
    ]);
    console.log(`\n${c.name}${c.isDemo ? "  [DEMO DATA, not real usage]" : ""}`);
    console.log(`  student accounts: ${students}`);
    console.log(`  students who placed at least one order: ${active.length}`);
    for (const e of events.sort((a, b) => a.type.localeCompare(b.type))) console.log(`  ${e.type.padEnd(16)} ${e._count._all}`);
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
