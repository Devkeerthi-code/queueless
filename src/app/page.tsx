import Link from "next/link";
import { redirect } from "next/navigation";
import { DemoRibbon } from "@/components/app-header";
import { DemoAccounts } from "@/components/auth/demo-accounts";
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
        <span aria-hidden="true" className="grid size-8 place-items-center rounded-[5px] bg-accent font-extrabold text-on-accent condensed">
          Q
        </span>
        <span className="font-semibold tracking-tight">QueueLess</span>
        <span className="hidden text-sm text-ink-muted sm:inline">at {canteen.name}</span>
        <Link href="/login" className="ml-auto rounded-slip px-3 py-2 text-sm font-semibold hover:bg-sunken">
          Log in
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="grid items-center gap-10 py-8 lg:grid-cols-12 lg:py-16">
          <div className="lg:col-span-7">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent-ink">{canteen.name}</p>
            <h1 className="condensed mt-4 text-[clamp(2.75rem,9vw,5.5rem)] font-extrabold leading-[0.92] tracking-[-0.02em]">
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
              <p className="mt-2 text-center text-sm text-ink-muted">Pickup 12:45 pm to 1:00 pm</p>
              <hr className="tear-line my-5" />
              <ul className="space-y-2 text-[15px]">
                <li className="flex items-center gap-2">
                  <VegMark isVeg /> 1× Veg thali <span className="num ml-auto">₹60</span>
                </li>
                <li className="flex items-center gap-2">
                  <VegMark isVeg={false} /> 1× Egg puff <span className="num ml-auto">₹25</span>
                </li>
              </ul>
              <div className="mt-6 flex items-center justify-between">
                <span className="text-sm text-ink-muted">Pay at counter</span>
                <span className="rubber-stamp -rotate-6 text-veg">Ready</span>
              </div>
            </TokenFace>
          </div>
        </section>

        <section aria-labelledby="how" className="border-t border-line py-12">
          <h2 id="how" className="text-sm font-semibold uppercase tracking-[0.18em] text-ink-muted">
            How it works
          </h2>
          <ol className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-slip border border-line bg-line md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="bg-surface p-6">
                <span className="num condensed text-4xl font-extrabold text-accent-ink">{s.n}</span>
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
