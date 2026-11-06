"use client";

import Image from "next/image";
import { useState } from "react";
import { GST_STATES, validateGstin } from "@/lib/gstin";
import { dayNames } from "@/lib/report-format";
import { cn } from "../ui/cn";
import { Field, fieldA11y, Input, Select, Switch } from "../ui/field";
import { gstinHint, type CanteenFormState } from "./canteen-form-state";

type Props = { value: CanteenFormState; onChange: (next: CanteenFormState) => void; errors: Record<string, string> };

const STATES = Object.entries(GST_STATES).sort((a, b) => a[1].localeCompare(b[1]));
const HINT_TONE = { muted: "text-ink-muted", ok: "text-veg", bad: "text-danger" } as const;

export function BasicsFields({ value, onChange, errors }: Props) {
  const set = <K extends keyof CanteenFormState>(key: K, v: CanteenFormState[K]) => onChange({ ...value, [key]: v });
  const hint = gstinHint(value.gstin);

  function setGstin(raw: string) {
    const gstin = raw.toUpperCase().replace(/\s/g, "").slice(0, 15);
    const check = validateGstin(gstin);
    onChange({ ...value, gstin, stateCode: check.ok ? check.stateCode : value.stateCode });
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Canteen name" id="c-name" error={errors.name} className="sm:col-span-2">
        <Input {...fieldA11y("c-name", errors.name)} value={value.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Main Block Canteen" />
      </Field>
      <Field label="Address (printed on bills)" id="c-address" error={errors.address} className="sm:col-span-2">
        <Input {...fieldA11y("c-address", errors.address)} value={value.address} onChange={(e) => set("address", e.target.value)} autoComplete="street-address" />
      </Field>
      <div className="sm:col-span-2">
        <Switch label="Registered for GST" checked={value.gstRegistered} onChange={(e) => set("gstRegistered", e.target.checked)} />
        <p className="mt-1 text-sm text-ink-muted">
          {value.gstRegistered ? "Bills are tax invoices with CGST and SGST." : "Bills are issued as a bill of supply, with no GST charged."}
        </p>
      </div>
      {value.gstRegistered && (
        <Field label="GSTIN" id="c-gstin" error={errors.gstin} className="sm:col-span-2">
          <Input
            {...fieldA11y("c-gstin", errors.gstin)}
            aria-describedby="c-gstin-hint"
            value={value.gstin}
            onChange={(e) => setGstin(e.target.value)}
            className="font-mono uppercase tracking-wider"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={15}
          />
          <p id="c-gstin-hint" className={cn("text-sm", HINT_TONE[hint.tone])} aria-live="polite">
            {hint.text}
          </p>
        </Field>
      )}
      <Field label="State" id="c-state" error={errors.stateCode}>
        <Select {...fieldA11y("c-state", errors.stateCode)} value={value.stateCode} onChange={(e) => set("stateCode", e.target.value)}>
          <option value="">Pick a state</option>
          {STATES.map(([code, name]) => (
            <option key={code} value={code}>
              {name} ({code})
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Invoice prefix" id="c-prefix" error={errors.invoicePrefix} hint={`Bills are numbered like ${value.invoicePrefix || "QL"}/2627/00001.`}>
        <Input {...fieldA11y("c-prefix", errors.invoicePrefix, true)} value={value.invoicePrefix} maxLength={4} className="uppercase" onChange={(e) => set("invoicePrefix", e.target.value.toUpperCase())} />
      </Field>
      <Field label="UPI ID (optional)" id="c-upi" error={errors.upiVpa} hint="Students get a pay-by-UPI button for this ID." className="sm:col-span-2">
        <Input {...fieldA11y("c-upi", errors.upiVpa, true)} value={value.upiVpa} placeholder="canteen@okbank" inputMode="email" spellCheck={false} onChange={(e) => set("upiVpa", e.target.value.trim())} />
      </Field>
    </div>
  );
}

export function HoursFields({ value, onChange, errors }: Props) {
  const set = <K extends keyof CanteenFormState>(key: K, v: CanteenFormState[K]) => onChange({ ...value, [key]: v });
  const toggleDay = (d: number) => set("openDays", value.openDays.includes(d) ? value.openDays.filter((x) => x !== d) : [...value.openDays, d].sort());
  const num = (key: keyof CanteenFormState, label: string, hint: string, id: string) => (
    <Field label={label} id={id} error={errors[key]} hint={hint}>
      <Input {...fieldA11y(id, errors[key], true)} type="number" inputMode="numeric" min={0} value={value[key] as string} onChange={(e) => set(key, e.target.value)} className="num" />
    </Field>
  );

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Opens at" id="c-open" error={errors.open}>
        <Input {...fieldA11y("c-open", errors.open)} type="time" value={value.open} onChange={(e) => set("open", e.target.value)} className="num" />
      </Field>
      <Field label="Closes at" id="c-close" error={errors.close}>
        <Input {...fieldA11y("c-close", errors.close)} type="time" value={value.close} onChange={(e) => set("close", e.target.value)} className="num" />
      </Field>
      <fieldset className="sm:col-span-2">
        <legend className="text-sm font-medium">Open on</legend>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {dayNames.map((name, d) => (
            <label key={name} className="press">
              <input type="checkbox" className="peer sr-only" checked={value.openDays.includes(d)} onChange={() => toggleDay(d)} />
              <span className="inline-flex h-10 min-w-12 items-center justify-center rounded-slip border border-line px-3 text-sm font-semibold text-ink-muted peer-checked:border-ink peer-checked:bg-ink peer-checked:text-on-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
                {name}
              </span>
            </label>
          ))}
        </div>
        {errors.openDays && <p className="mt-1 text-sm text-danger">{errors.openDays}</p>}
      </fieldset>
      {num("slotMinutes", "Pickup slot length (minutes)", "15 works for most canteens.", "c-slot")}
      {num("maxOrdersPerSlot", "Orders per slot", "How many orders the kitchen can finish in one slot.", "c-cap")}
      {num("orderCutoffMinutes", "Stop orders before a slot (minutes)", "Gives the kitchen time to start.", "c-cutoff")}
      {num("noShowGraceMinutes", "No-show after (minutes)", "Uncollected this long after the slot ends.", "c-grace")}
      {num("noShowThreshold", "Pay first after this many no-shows", "In the last 30 days. 0 turns this off.", "c-threshold")}
    </div>
  );
}

const MAX_LOGO_BYTES = 400 * 1024;

/** Logo picker with an instant preview. The server checks size and type again. */
export function LogoField({ currentUrl, onFile }: { currentUrl: string | null; onFile: (file: File | null) => void }) {
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [error, setError] = useState("");

  function pick(file: File | undefined) {
    setError("");
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      setError("Keep the logo under 400 KB.");
      onFile(null);
      return;
    }
    setPreview(URL.createObjectURL(file));
    onFile(file);
  }

  return (
    <div className="flex items-center gap-4">
      <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-slip border border-dashed border-line bg-sunken">
        {preview ? <Image src={preview} alt="Logo preview" width={64} height={64} unoptimized className="size-full object-cover" /> : <span className="text-xs text-ink-muted">No logo</span>}
      </div>
      <Field label="Logo (optional)" id="c-logo" error={error} hint="PNG, JPEG or WebP, under 400 KB. Printed on invoices." className="min-w-0 flex-1">
        <input id="c-logo" type="file" accept="image/png,image/jpeg,image/webp" aria-describedby="c-logo-msg" onChange={(e) => pick(e.target.files?.[0])} className="w-full min-w-0 text-sm file:mr-3 file:h-9 file:rounded-slip file:border file:border-line file:bg-surface file:px-3 file:font-semibold file:text-ink" />
      </Field>
    </div>
  );
}
