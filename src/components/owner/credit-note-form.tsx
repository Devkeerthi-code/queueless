"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { creditNoteAction } from "@/app/actions/owner";
import { formatPaise } from "@/lib/money";
import { Button } from "../ui/button";
import { Field, fieldA11y, Input } from "../ui/field";
import { useAction } from "../use-action";

type Line = { id: string; name: string; quantity: number; refundable: number; totalPaise: number };

/** Refund some or all of a bill. Restocking is only allowed if the kitchen never started the order. */
export function CreditNoteForm({ invoiceId, lines, canRestock }: { invoiceId: string; lines: Line[]; canRestock: boolean }) {
  const router = useRouter();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [restock, setRestock] = useState(canRestock);
  const [reason, setReason] = useState("");
  const { run, pending, fields } = useAction();
  const chosen = lines.filter((l) => (qty[l.id] ?? 0) > 0);
  const refundable = lines.filter((l) => l.refundable > 0);

  if (refundable.length === 0) return <p className="text-sm text-ink-muted">Everything on this bill has already been refunded.</p>;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    run(
      () => creditNoteAction({ invoiceId, reason, lines: chosen.map((l) => ({ invoiceLineId: l.id, quantity: qty[l.id], restock: canRestock && restock })) }),
      {
        success: (n) => `Credit note ${n.number} issued for ${formatPaise(n.totalPaise)}`,
        onOk: () => {
          setQty({});
          setReason("");
          router.refresh();
        },
      },
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <ul className="divide-y divide-line">
        {refundable.map((l) => (
          <li key={l.id} className="flex items-center gap-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{l.name}</span>
              <span className="font-mono text-xs text-ink-muted">{l.refundable} of {l.quantity} refundable</span>
            </span>
            <label className="sr-only" htmlFor={`cn-${l.id}`}>
              Quantity of {l.name} to refund
            </label>
            <div className="w-20 shrink-0">
              <Input
                id={`cn-${l.id}`}
                type="number"
                min={0}
                max={l.refundable}
                inputMode="numeric"
                className="font-mono text-center"
                value={qty[l.id] ?? 0}
                onChange={(e) => setQty({ ...qty, [l.id]: Math.max(0, Math.min(l.refundable, Number(e.target.value) || 0)) })}
              />
            </div>
          </li>
        ))}
      </ul>
      <label className={`flex items-start gap-3 text-sm ${canRestock ? "" : "text-ink-muted"}`}>
        <input type="checkbox" className="mt-0.5 size-4 accent-[var(--ink)]" checked={canRestock && restock} disabled={!canRestock} onChange={(e) => setRestock(e.target.checked)} aria-describedby="restock-why" />
        <span>
          Put the items back in today&apos;s stock
          <span id="restock-why" className="block text-xs text-ink-muted">
            {canRestock ? "Only if the food was never made." : "Not possible: the kitchen already started this order, or it's from an earlier day."}
          </span>
        </span>
      </label>
      <Field label="Reason (printed on the credit note)" id="cn-reason" error={fields.reason}>
        <Input {...fieldA11y("cn-reason", fields.reason)} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Wrong item served" />
      </Field>
      <Button type="submit" variant="danger" pending={pending} disabled={chosen.length === 0 || reason.trim().length < 3}>
        Issue credit note
        {chosen.length > 0 && <span className="font-mono">· {formatPaise(chosen.reduce((s, l) => s + Math.round((l.totalPaise * qty[l.id]) / l.quantity), 0))}</span>}
      </Button>
    </form>
  );
}
