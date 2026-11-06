import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/** pg warns that sslmode=require will change meaning; verify-full is what it does today, so say so explicitly. */
export function normaliseSslMode(url: string): string {
  return url.replace(/sslmode=(require|prefer|verify-ca)/, "sslmode=verify-full");
}

export function createPrisma(connectionString: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString: normaliseSslMode(connectionString), max: 10 });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function lazyClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set. See .env.example.");
    globalForPrisma.prisma = createPrisma(url);
  }
  return globalForPrisma.prisma;
}

// A proxy keeps imports cheap at build time and reuses one client across hot reloads.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = lazyClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
export type Db = PrismaClient | Tx;

export const TX_OPTIONS = { maxWait: 15_000, timeout: 20_000 } as const;
