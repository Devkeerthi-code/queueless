import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintLinks } from "@/components/counter/print-links";
import { CreditNoteForm } from "@/components/owner/credit-note-form";
import { Panel } from "@/components/owner/page-title";
import { formatBp, formatPaise } from "@/lib/money";
import { formatIstDateTime } from "@/lib/time";
import { requireRole } from "@/server/auth";
import { invoiceDetail } from "@/server/views";

export const metadata: Metadata = { title: "Bill" };

const SERIES: Record<string, string> = { INV: "Tax invoice", BOS: "Bill of supply" };

export default async function InvoicePage({ params }: PageProps<"/owner/invoices/[id]">) {
  const user = await requireRole("OWNER");
  const { id } = await params;
  const inv = await invoiceDetail(user.canteenId, id);
  if (!inv) notFound();

  return (
    <>
      <Link href="/owner/invoices" className="text-sm font-semibold text-ink-muted hover:text-ink">
        ← All bills
      </Link>
      <div className="mb-6 mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">{SERIES[inv.series] ?? inv.series}</p>
          <h1 className="font-mono condensed text-4xl font-extrabold">{inv.number}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Token <span className="font-mono font-semibold text-ink">{inv.token}</span> · {formatIstDateTime(new Date(inv.issuedAt))} · {inv.paymentMode === "UPI" ? "UPI" : "Cash"}
          </p>
        </div>
        <PrintLinks invoiceId={inv.id} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel title="Tax invoice · items" edge="torn">
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[420px] font-mono text-sm">
              <thead className="text-left text-xs text-ink-muted">
                <tr className="border-b border-line">
                  <th scope="col" className="py-2 font-medium">Item</th>
                  <th scope="col" className="py-2 text-right font-medium">Qty</th>
                  <th scope="col" className="py-2 text-right font-medium">Rate</th>
                  <th scope="col" className="py-2 text-right font-medium">GST</th>
                  <th scope="col" className="py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {inv.lines.map((l) => (
                  <tr key={l.id} className="border-b border-line">
                    <th scope="row" className="py-2 text-left font-medium">
                      {l.name}
                      {l.refundable < l.quantity && <span className="block text-xs font-normal text-danger">{l.quantity - l.refundable} refunded</span>}
                    </th>
                    <td className="py-2 text-right">{l.quantity}</td>
                    <td className="py-2 text-right">{formatPaise(l.unitPricePaise)}</td>
                    <td className="py-2 text-right">{formatBp(l.gstRateBp)}</td>
                    <td className="py-2 text-right">{formatPaise(l.totalPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="font-mono ml-auto mt-4 grid w-64 grid-cols-2 gap-y-1 text-sm">
            <dt className="text-ink-muted">Taxable value</dt>
            <dd className="text-right">{formatPaise(inv.taxablePaise)}</dd>
            <dt className="text-ink-muted">GST</dt>
            <dd className="text-right">{formatPaise(inv.taxPaise)}</dd>
            <dt className="border-t border-line pt-1 font-bold">Total</dt>
            <dd className="border-t border-line pt-1 text-right text-lg font-bold">{formatPaise(inv.totalPaise)}</dd>
          </dl>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title="Credit memo · refund">
            <CreditNoteForm invoiceId={inv.id} lines={inv.lines} canRestock={inv.canRestock} />
          </Panel>
          <Panel title="Credit notes">
            {inv.creditNotes.length === 0 ? (
              <p className="text-sm text-ink-muted">None issued against this bill.</p>
            ) : (
              <ul className="divide-y divide-line">
                {inv.creditNotes.map((c) => (
                  <li key={c.id} className="flex flex-col gap-2 py-3">
                    <div className="flex justify-between gap-2">
                      <span className="font-mono font-semibold">{c.number}</span>
                      <span className="font-mono font-semibold text-danger">−{formatPaise(c.totalPaise)}</span>
                    </div>
                    <p className="text-sm text-ink-muted">
                      {formatIstDateTime(new Date(c.issuedAt))} · {c.reason}
                    </p>
                    <PrintLinks invoiceId={c.id} kind="credit-notes" />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
