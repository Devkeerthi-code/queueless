"use client";

import Image from "next/image";
import { useState } from "react";
import { saveItemAction } from "@/app/actions/owner";
import { formatPaise, parsePercentToBp, parseRupees } from "@/lib/money";
import type { OwnerMenuItem } from "@/server/owner-views";
import { Button } from "../ui/button";
import { Field, fieldA11y, Input, Select, Switch } from "../ui/field";
import { VegMark } from "../ui/veg-mark";
import { useAction } from "../use-action";

type Form = {
  name: string; category: string; isVeg: boolean; price: string; priceIncludesGst: boolean; gstRate: string;
  hsnSac: string; cost: string; dailyQuantity: string; prepMinutes: string;
};

const rupees = (p: number) => (p / 100).toFixed(p % 100 === 0 ? 0 : 2);
const MAX_PHOTO = 400 * 1024;
// Server field names to the inputs they came from.
const FIELD_FOR: Record<string, keyof Form> = { pricePaise: "price", costPaise: "cost", gstRateBp: "gstRate" };

function initialForm(item: OwnerMenuItem | null): Form {
  if (!item) return { name: "", category: "", isVeg: true, price: "", priceIncludesGst: true, gstRate: "5", hsnSac: "996331", cost: "", dailyQuantity: "50", prepMinutes: "5" };
  return {
    name: item.name, category: item.category, isVeg: item.isVeg, price: rupees(item.pricePaise), priceIncludesGst: item.priceIncludesGst,
    gstRate: String(item.gstRateBp / 100), hsnSac: item.hsnSac, cost: rupees(item.costPaise), dailyQuantity: String(item.dailyQuantity), prepMinutes: String(item.prepMinutes),
  };
}

/** Add or edit one item. Prices are typed in rupees and sent as paise. */
export function ItemForm({ item, categories, onSaved }: { item: OwnerMenuItem | null; categories: string[]; onSaved: () => void }) {
  const [form, setForm] = useState(() => initialForm(item));
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState(item?.photoUrl ?? null);
  const [local, setLocal] = useState<Partial<Record<keyof Form | "photo", string>>>({});
  const { run, pending, fields } = useAction();
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const server = Object.fromEntries(Object.entries(fields).map(([k, v]) => [FIELD_FOR[k] ?? k, v])) as Partial<Record<keyof Form, string>>;
  const err = (k: keyof Form) => local[k] ?? server[k];

  const pricePaise = parseRupees(form.price);
  const costPaise = parseRupees(form.cost || "0");
  const margin = pricePaise !== null && costPaise !== null && pricePaise > 0 ? Math.round(((pricePaise - costPaise) / pricePaise) * 100) : null;

  function pickPhoto(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_PHOTO) return setLocal((l) => ({ ...l, photo: "Keep photos under 400 KB." }));
    setLocal((l) => ({ ...l, photo: undefined }));
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const gstRateBp = parsePercentToBp(form.gstRate);
    const errors: typeof local = {};
    if (!form.name.trim()) errors.name = "Give the item a name.";
    if (!form.category.trim()) errors.category = "Pick or type a category.";
    if (pricePaise === null) errors.price = "Enter a price like 45 or 45.50.";
    if (costPaise === null) errors.cost = "Enter a cost like 18 or 18.50.";
    if (!/^\d{4,8}$/.test(form.hsnSac.trim())) errors.hsnSac = "HSN/SAC is 4 to 8 digits.";
    setLocal(errors);
    if (Object.keys(errors).length || pricePaise === null || costPaise === null || gstRateBp === null) return;

    const data = new FormData();
    data.set("item", JSON.stringify({
      name: form.name.trim(), category: form.category.trim(), isVeg: form.isVeg, pricePaise, priceIncludesGst: form.priceIncludesGst, gstRateBp,
      hsnSac: form.hsnSac.trim(), costPaise, dailyQuantity: Number(form.dailyQuantity), prepMinutes: Number(form.prepMinutes),
    }));
    if (item) data.set("id", item.id);
    if (photo) data.set("photo", photo);
    run(() => saveItemAction(data), { success: item ? `${form.name} saved` : `${form.name} added to the menu`, onOk: onSaved });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 p-5" noValidate>
      <Field label="Name" id="i-name" error={err("name")}>
        <Input {...fieldA11y("i-name", err("name"))} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Masala dosa" />
      </Field>
      <Field label="Category" id="i-cat" error={err("category")} hint="Pick one or type a new one.">
        <Input {...fieldA11y("i-cat", err("category"), true)} list="i-cat-list" value={form.category} onChange={(e) => set("category", e.target.value)} />
        <datalist id="i-cat-list">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>
      <fieldset className="flex gap-2">
        <legend className="mb-1.5 text-sm font-medium">Type</legend>
        {[true, false].map((veg) => (
          <label key={String(veg)} className="press flex-1">
            <input type="radio" name="i-veg" className="peer sr-only" checked={form.isVeg === veg} onChange={() => set("isVeg", veg)} />
            <span className="flex h-11 items-center justify-center gap-2 rounded-slip border border-line text-sm font-semibold peer-checked:border-ink peer-checked:bg-sunken peer-focus-visible:outline-2 peer-focus-visible:outline-ink">
              <VegMark isVeg={veg} className="pointer-events-none" />
              {veg ? "Veg" : "Non-veg"}
            </span>
          </label>
        ))}
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Price (₹)" id="i-price" error={err("price")}>
          <Input {...fieldA11y("i-price", err("price"))} inputMode="decimal" className="num" value={form.price} onChange={(e) => set("price", e.target.value)} />
        </Field>
        <Field label="Food cost (₹)" id="i-cost" error={err("cost")} hint={margin !== null ? `${margin}% margin` : undefined}>
          <Input {...fieldA11y("i-cost", err("cost"), margin !== null)} inputMode="decimal" className="num" value={form.cost} onChange={(e) => set("cost", e.target.value)} />
        </Field>
        <Field label="GST rate" id="i-gst" error={err("gstRate")}>
          <Select {...fieldA11y("i-gst", err("gstRate"))} value={form.gstRate} onChange={(e) => set("gstRate", e.target.value)}>
            {["0", "5", "12", "18"].map((r) => (
              <option key={r} value={r}>{r}%</option>
            ))}
          </Select>
        </Field>
        <Field label="HSN/SAC" id="i-hsn" error={err("hsnSac")}>
          <Input {...fieldA11y("i-hsn", err("hsnSac"))} inputMode="numeric" className="num" value={form.hsnSac} onChange={(e) => set("hsnSac", e.target.value)} />
        </Field>
      </div>
      <Switch label="Price already includes GST" checked={form.priceIncludesGst} onChange={(e) => set("priceIncludesGst", e.target.checked)} />
      {pricePaise !== null && !form.priceIncludesGst && <p className="-mt-2 text-sm text-ink-muted">Students pay about {formatPaise(pricePaise + Math.round((pricePaise * Number(form.gstRate || 0)) / 100))}.</p>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Made per day" id="i-qty" error={err("dailyQuantity")} hint="Stock resets each morning.">
          <Input {...fieldA11y("i-qty", err("dailyQuantity"), true)} type="number" min={0} inputMode="numeric" className="num" value={form.dailyQuantity} onChange={(e) => set("dailyQuantity", e.target.value)} />
        </Field>
        <Field label="Prep minutes" id="i-prep" error={err("prepMinutes")}>
          <Input {...fieldA11y("i-prep", err("prepMinutes"))} type="number" min={0} inputMode="numeric" className="num" value={form.prepMinutes} onChange={(e) => set("prepMinutes", e.target.value)} />
        </Field>
      </div>
      <div className="flex items-center gap-4">
        <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-slip border border-dashed border-line bg-sunken">
          {preview ? <Image src={preview} alt="Item photo preview" width={64} height={64} unoptimized className="size-full object-cover" /> : <span className="text-xs text-ink-muted">No photo</span>}
        </div>
        <Field label="Photo (optional)" id="i-photo" error={local.photo} hint="Under 400 KB." className="min-w-0 flex-1">
          <input id="i-photo" type="file" accept="image/png,image/jpeg,image/webp" aria-describedby="i-photo-msg" onChange={(e) => pickPhoto(e.target.files?.[0])} className="w-full min-w-0 text-sm file:mr-3 file:h-9 file:rounded-slip file:border file:border-line file:bg-surface file:px-3 file:font-semibold file:text-ink" />
        </Field>
      </div>
      <Button type="submit" variant="ink" size="lg" pending={pending} className="mt-2">
        {item ? "Save changes" : "Add item"}
      </Button>
    </form>
  );
}
