import Link from "next/link";

export const DEMO_ACCOUNTS = [
  { email: "student@demo.queueless.in", role: "Student", does: "Order from the menu and get a token" },
  { email: "kitchen@demo.queueless.in", role: "Kitchen", does: "See orders by pickup slot, mark them ready" },
  { email: "counter@demo.queueless.in", role: "Counter", does: "Scan the QR, take payment, hand over" },
  { email: "owner@demo.queueless.in", role: "Owner", does: "Menu, stock, invoices and reports" },
] as const;

/** Shown only for the demo canteen. Each account opens the login form with the email filled in. */
export function DemoAccounts({ password, headingId }: { password: string; headingId: string }) {
  return (
    <div className="slip border-dashed p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={headingId} className="font-semibold">
          Demo logins
        </h2>
        <p className="text-sm text-ink-muted">
          Password for all: <code className="num rounded-[4px] bg-sunken px-1.5 py-0.5 font-semibold text-ink">{password}</code>
        </p>
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {DEMO_ACCOUNTS.map((a) => (
          <li key={a.email}>
            <Link href={`/login?email=${encodeURIComponent(a.email)}`} className="press flex flex-col rounded-slip border border-line bg-paper px-3 py-2.5 hover:border-ink/40">
              <span className="text-sm font-semibold">{a.role}</span>
              <span className="truncate text-sm text-ink-muted">{a.email}</span>
              <span className="text-xs text-ink-muted">{a.does}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
