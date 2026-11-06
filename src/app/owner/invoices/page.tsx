import type { Metadata } from "next";
import Link from "next/link";
import { PageTitle } from "@/components/owner/page-title";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/field";
import { formatPaise } from "@/lib/money";
import { formatIstDateTime } from "@/lib/time";
import { requireRole } from "@/server/auth";
import { invoiceList } from "@/server/views";

export const metadata: Metadata = { title: "Bills" };

export default async function InvoicesPage({ searchParams }: PageProps<"/owner/invoices">) {
  const user = await requireRole("OWNER");
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.slice(0, 40) : "";
  const invoices = await invoiceList(user.canteenId, { q: query });

  return (
    <>
      <PageTitle title="Bills" subtitle="Latest 50 invoices. Search by invoice number or today's token." />
      <form method="get" role="search" className="mb-4 flex max-w-md gap-2">
        <Input name="q" type="search" defaultValue={query} placeholder="QL/2627/00042 or A23" aria-label="Search bills" />
        <button type="submit" className={buttonClass("ink")}>
          Search
        </button>
      </form>
      {invoices.length === 0 ? (
        <EmptyState title={query ? `No bills match "${query}"` : "No bills yet"}>{query ? "Check the number, or clear the search." : "Bills appear here once the counter hands over an order."}</EmptyState>
      ) : (
        <ul className="slip divide-y divide-line">
          {invoices.map((i) => (
            <li key={i.id}>
              <Link href={`/owner/invoices/${i.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-0.5 px-4 py-3 hover:bg-sunken sm:grid-cols-[180px_70px_minmax(0,1fr)_auto]">
                <span className="num font-semibold">{i.number}</span>
                <span className="num text-right font-semibold sm:order-last">{formatPaise(i.totalPaise)}</span>
                <span className="num condensed text-lg font-bold text-ink-muted">{i.token}</span>
                <span className="text-sm text-ink-muted">
                  {formatIstDateTime(new Date(i.issuedAt))} · {i.paymentMode === "UPI" ? "UPI" : "Cash"} · {i.source === "WALK_IN" ? "Walk-in" : "Pre-order"}
                  {i.creditedPaise > 0 && <span className="font-semibold text-danger"> · refunded {formatPaise(i.creditedPaise)}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
