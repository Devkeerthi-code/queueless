import Link from "next/link";
import { redirect } from "next/navigation";
import { DemoRibbon } from "@/components/app-header";
import { DemoAccounts } from "@/components/auth/demo-accounts";
import { BrandMark } from "@/components/paper/brand-mark";
import { TokenFace } from "@/components/token-face";
import { ButtonLink } from "@/components/ui/button";
import { VegMark } from "@/components/ui/veg-mark";
import { HOME_FOR_ROLE } from "@/lib/permissions";
import { getCurrentUser } from "@/server/auth";
import { getCanteen } from "@/server/canteen";

const STEPS = [
  { n: "01", title: "Order before the bell", body: "Pick from today's menu and a 15-minute pickup slot. Sold-out items are marked before you walk over." },
  { n: "02", title: "The kitchen cooks for your slot", body: "Orders reach the kitchen screen grouped by pickup time, so food is hot when you arrive, not 20 minutes early." },
  { n: "03", title: "Show the QR, take your food", body: "You get a notification when it's ready. The counter scans your code, you pay by cash or UPI, done." },
];

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect(HOME_FOR_ROLE[user.role]);
  const canteen = await getCanteen();
  if (!canteen) redirect("/setup");
  const demoPassword = canteen.isDemo ? (process.env.DEMO_PASSWORD ?? "") : "";

  return (
    <>
      {canteen.isDemo && <DemoRibbon />}
      <header className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <BrandMark className="size-8" />
        <span className="condensed text-xl font-extrabold uppercase">QueueLess</span>
        <span className="hidden text-sm text-ink-muted sm:inline">at {canteen.name}</span>
        <Link href="/login" className="ml-auto rounded-slip px-3 py-2 text-sm font-semibold hover:bg-sunken">
          Log in
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="grid items-center gap-10 py-8 lg:grid-cols-12 lg:py-16">
          <div className="lg:col-span-7">
            <p className="caps text-accent-ink">{canteen.name}</p>
            <h1 className="condensed mt-4 text-[clamp(2.75rem,9vw,5.5rem)] font-extrabold uppercase leading-[0.9] tracking-[-0.01em]">
              Lunch break is short. <span className="text-ink-muted">Don&apos;t spend it in the queue.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-ink-muted">
              Order from class, pick a pickup slot, and collect with a token. You see what&apos;s sold out before you walk over, and your usual order takes one tap.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/signup" variant="accent" size="lg">
                Create student account
              </ButtonLink>
              <ButtonLink href="/login" variant="outline" size="lg">
                Log in
              </ButtonLink>
            </div>
          </div>
          <div className="mx-auto w-full max-w-[340px] lg:col-span-5">
            <TokenFace token="A23" caption="Example token">
              <p className="text-center font-mono text-sm">PICKUP 12:45 pm – 1:00 pm</p>
              <hr className="tear-line my-4" />
              <ul className="space-y-1.5 font-mono text-[14px]">
                <li className="flex items-center gap-2">
                  <VegMark isVeg /> 1× Veg thali <span className="ml-auto">₹60</span>
                </li>
                <li className="flex items-center gap-2">
                  <VegMark isVeg={false} /> 1× Egg puff <span className="ml-auto">₹25</span>
                </li>
              </ul>
              <div className="mt-4 flex items-center justify-between pb-2">
                <span className="font-mono text-sm">PAY AT COUNTER · ₹85</span>
                <span className="rubber-stamp -rotate-6 text-lg text-veg">Ready</span>
              </div>
            </TokenFace>
          </div>
        </section>

        <section aria-labelledby="how" className="border-t border-line py-12">
          <h2 id="how" className="condensed text-3xl font-extrabold uppercase">
            How it works
          </h2>
          <ol className="lift mt-6 flex flex-col md:flex-row">
            {STEPS.map((s, i) => (
              <li key={s.n} className="paper edge-perf-x relative flex-1 px-7 py-6">
                {i > 0 && <span aria-hidden="true" className="absolute inset-x-6 top-0 border-t-2 border-dashed border-line md:hidden" />}
                <span className="condensed text-5xl font-extrabold text-accent-ink">{s.n}</span>
                <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-ink-muted">{s.body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 max-w-2xl text-sm text-ink-muted">
            Canteen staff use the same app: a kitchen board readable from across the room, a counter scanner that prints GST invoices, and daily sales and wastage reports for the owner.
          </p>
        </section>

        {canteen.isDemo && demoPassword && (
          <section aria-labelledby="demo" className="pb-16">
            <DemoAccounts password={demoPassword} headingId="demo" />
          </section>
        )}
      </main>
    </>
  );
}
