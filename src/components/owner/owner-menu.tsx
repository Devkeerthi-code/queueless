"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { archiveItemAction } from "@/app/actions/owner";
import { setAvailabilityAction } from "@/app/actions/orders";
import { formatPaise } from "@/lib/money";
import type { OwnerMenuItem } from "@/server/owner-views";
import { LOW_STOCK_AT } from "@/lib/stock";
import { Button } from "../ui/button";
import { EmptyState } from "../ui/empty-state";
import { Switch } from "../ui/field";
import { Sheet } from "../ui/sheet";
import { VegMark } from "../ui/veg-mark";
import { useAction } from "../use-action";
import { CsvImport } from "./csv-import";
import { ItemForm } from "./item-form";
import { PageTitle } from "./page-title";

type Panel = { kind: "edit"; item: OwnerMenuItem | null } | { kind: "import" } | null;

export function OwnerMenu({ items }: { items: OwnerMenuItem[] }) {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>(null);
  const [available, setAvailable] = useState<Record<string, boolean>>({});
  const toggle = useAction();
  const categories = [...new Set(items.map((i) => i.category))];
  const close = () => setPanel(null);
  const saved = () => {
    close();
    router.refresh();
  };

  function setOn(item: OwnerMenuItem, on: boolean) {
    setAvailable((a) => ({ ...a, [item.id]: on }));
    toggle.run(() => setAvailabilityAction(item.id, on), {
      success: on ? `${item.name} is on the menu` : `${item.name} hidden for today`,
      onError: () => setAvailable((a) => ({ ...a, [item.id]: !on })),
    });
  }

  return (
    <>
      <PageTitle
        title="Menu"
        subtitle={`${items.length} items · stock resets every morning`}
        actions={
          <>
            <Button variant="outline" onClick={() => setPanel({ kind: "import" })}>
              Import CSV
            </Button>
            <Button variant="accent" onClick={() => setPanel({ kind: "edit", item: null })}>
              Add item
            </Button>
          </>
        }
      />
      {items.length === 0 ? (
        <EmptyState title="No items yet" action={<Button variant="accent" onClick={() => setPanel({ kind: "edit", item: null })}>Add your first item</Button>}>
          Add items one by one, or import a CSV with your whole menu.
        </EmptyState>
      ) : (
        categories.map((cat) => (
          <section key={cat} className="mb-6" aria-labelledby={`cat-${cat}`}>
            <h2 id={`cat-${cat}`} className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
              {cat}
            </h2>
            <div className="slip divide-y divide-line">
              <div className="hidden grid-cols-[minmax(0,1fr)_90px_100px_110px_120px_150px] gap-4 px-4 py-2 text-xs font-medium text-ink-muted md:grid" aria-hidden="true">
                <span>Item</span>
                <span className="text-right">Price</span>
                <span className="text-right">Left today</span>
                <span className="text-right">Make tomorrow</span>
                <span>Available</span>
                <span />
              </div>
              {items
                .filter((i) => i.category === cat)
                .map((item) => (
                  <Row key={item.id} item={item} on={available[item.id] ?? item.isAvailable} onToggle={(on) => setOn(item, on)} onEdit={() => setPanel({ kind: "edit", item })} onArchived={() => router.refresh()} />
                ))}
            </div>
          </section>
        ))
      )}

      <Sheet variant="drawer" open={panel?.kind === "edit"} onClose={close} title={panel?.kind === "edit" && panel.item ? `Edit ${panel.item.name}` : "Add item"}>
        {panel?.kind === "edit" && <ItemForm key={panel.item?.id ?? "new"} item={panel.item} categories={categories} onSaved={saved} />}
      </Sheet>
      <Sheet variant="drawer" open={panel?.kind === "import"} onClose={close} title="Import menu from CSV">
        <CsvImport onDone={() => router.refresh()} />
      </Sheet>
    </>
  );
}

function Row({ item, on, onToggle, onEdit, onArchived }: { item: OwnerMenuItem; on: boolean; onToggle: (on: boolean) => void; onEdit: () => void; onArchived: () => void }) {
  const archive = useAction();
  const [armed, setArmed] = useState(false);
  const low = item.remaining <= LOW_STOCK_AT;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_90px_100px_110px_120px_150px]">
      <div className="flex min-w-0 items-center gap-3">
        {item.photoUrl && <Image src={item.photoUrl} alt="" width={40} height={40} unoptimized className="size-10 shrink-0 rounded-[4px] border border-line object-cover" />}
        <VegMark isVeg={item.isVeg} />
        <span className="truncate font-semibold">{item.name}</span>
      </div>
      <span className="font-mono text-right font-semibold">{formatPaise(item.pricePaise, { trimWhole: true })}</span>
      <span className="font-mono text-sm text-ink-muted md:text-right md:text-[15px] md:text-ink">
        <span className="md:hidden">Left today: </span>
        <span className={low ? "font-semibold text-warn" : ""}>{item.remaining}</span>
        <span className="text-ink-muted"> / {item.dailyQuantity}</span>
      </span>
      <span className="text-right font-mono text-sm text-ink-muted md:text-[15px]" title="Average sold on this weekday over the last 4 weeks, plus 10%">
        <span className="md:hidden">Make tomorrow: </span>
        {item.suggestedTomorrow ?? "–"}
      </span>
      <Switch label={on ? "On" : "Off"} checked={on} onChange={(e) => onToggle(e.target.checked)} aria-label={`${item.name} available today`} />
      <div className="flex justify-end gap-1">
        <Button variant="quiet" size="sm" onClick={onEdit}>
          Edit
        </Button>
        <Button
          variant={armed ? "danger" : "quiet"}
          size="sm"
          pending={archive.pending}
          onClick={() => {
            if (!armed) return setArmed(true);
            archive.run(() => archiveItemAction(item.id), { success: `${item.name} archived. Past bills keep it.`, onOk: onArchived });
          }}
          onBlur={() => setArmed(false)}
        >
          {armed ? "Confirm" : "Archive"}
        </Button>
      </div>
    </div>
  );
}
