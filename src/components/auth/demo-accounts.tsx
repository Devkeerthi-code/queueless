import Link from "next/link";

export const DEMO_ACCOUNTS = [
  { email: "student@demo.queueless.in", role: "Student", does: "Order from the rate card, get a token" },
  { email: "kitchen@demo.queueless.in", role: "Kitchen", does: "Tickets on the rail, mark them ready" },
  { email: "counter@demo.queueless.in", role: "Counter", does: "Scan, take payment, hand over" },
  { email: "owner@demo.queueless.in", role: "Owner", does: "Menu, stock, bills and the day book" },
] as const;

/** Four pre-printed passes, shown only for the demo canteen. Each opens the login with the email filled in. */
export function DemoAccounts({ password, headingId }: { password: string; headingId: string }) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={headingId} className="condensed text-2xl font-extrabold uppercase">
          Demo passes
        </h2>
        <p className="text-sm text-ink-muted">
          Password for all: <code className="rounded-[3px] bg-accent px-1.5 py-0.5 font-mono font-semibold text-on-accent">{password}</code>
        </p>
      </div>
      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {DEMO_ACCOUNTS.map((a, i) => (
          <li key={a.email} className={`lift ${i % 2 ? "rotate-[0.6deg]" : "-rotate-[0.5deg]"}`}>
            <Link href={`/login?email=${encodeURIComponent(a.email)}`} className="press paper punched flex flex-col px-4 pb-3 pt-7 hover:brightness-[.98]">
              <span className="flex items-baseline justify-between gap-2">
                <span className="condensed text-2xl font-extrabold uppercase">{a.role}</span>
                <span className="caps text-ink-muted">Pass</span>
              </span>
              <span className="truncate font-mono text-[13px]">{a.email}</span>
              <span className="mt-1 text-xs text-ink-muted">{a.does}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
