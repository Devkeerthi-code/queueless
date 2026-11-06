import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  QR_SECRET: z.string().min(32, "QR_SECRET must be at least 32 characters"),
  CRON_SECRET: z.string().min(16, "CRON_SECRET must be at least 16 characters"),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional().default(""),
  VAPID_PRIVATE_KEY: z.string().optional().default(""),
  VAPID_SUBJECT: z.string().optional().default(""),
  DEMO_PASSWORD: z.string().optional().default(""),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/** Parsed lazily so `next build` doesn't need secrets, but the first request fails loudly if one is missing. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment variables. ${problems}. See .env.example.`);
  }
  cached = parsed.data;
  return cached;
}

export function pushConfigured(): boolean {
  const e = env();
  return Boolean(e.NEXT_PUBLIC_VAPID_PUBLIC_KEY && e.VAPID_PRIVATE_KEY && e.VAPID_SUBJECT);
}
