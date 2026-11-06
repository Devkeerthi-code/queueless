"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { setupAction } from "@/app/actions/auth";
import { cn } from "../ui/cn";
import { Button } from "../ui/button";
import { Field, fieldA11y, Input } from "../ui/field";
import { useAction } from "../use-action";
import { BasicsFields, HoursFields, LogoField } from "../owner/canteen-fields";
import { basicsErrors, DEFAULT_CANTEEN, toPayload } from "../owner/canteen-form-state";

const STEPS = ["Canteen", "Hours and slots", "Your account"] as const;
const OWNER_FIELDS = new Set(["email", "password"]);
const HOURS_FIELDS = new Set(["open", "close", "openDays", "slotMinutes", "maxOrdersPerSlot", "orderCutoffMinutes", "noShowGraceMinutes", "noShowThreshold"]);

/** First run: three short steps, then the owner lands on their dashboard. */
export function SetupWizard() {
  const router = useRouter();
  const { run, pending, fields } = useAction();
  const [step, setStep] = useState(0);
  const [canteen, setCanteen] = useState(DEFAULT_CANTEEN);
  const [logo, setLogo] = useState<File | null>(null);
  const [owner, setOwner] = useState({ name: "", email: "", password: "" });
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});

  const [errorStep, setErrorStep] = useState<number | null>(null);
  const canteenErrors = errorStep === 2 ? localErrors : { ...fields, ...localErrors };
  const ownerErrors = errorStep === 2 ? fields : {};

  function next(e: React.FormEvent) {
    e.preventDefault();
    if (step === 0) {
      const errs = basicsErrors(canteen);
      setLocalErrors(errs);
      if (Object.keys(errs).length) return;
    }
    if (step < 2) return setStep(step + 1);
    const form = new FormData();
    form.set("canteen", JSON.stringify(toPayload(canteen)));
    form.set("owner", JSON.stringify(owner));
    if (logo) form.set("logo", logo);
    run(() => setupAction(form), {
      onOk: ({ home }) => router.replace(home),
      onError: (r) => {
        const target = serverStepFor(Object.keys(r.fields ?? {}), canteen.name.trim().length >= 2);
        setErrorStep(target);
        if (target !== null) setStep(target);
      },
    });
  }

  return (
    <form onSubmit={next} noValidate>
      <ol className="mb-8 grid grid-cols-3 gap-2" aria-label="Setup steps">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={i === step ? "step" : undefined}>
            <div className={cn("h-1 rounded-full transition-colors duration-150", i <= step ? "bg-accent" : "bg-line")} />
            <span className={cn("mt-2 block text-xs font-semibold", i === step ? "text-ink" : "text-ink-muted")}>
              {i + 1}. {label}
            </span>
          </li>
        ))}
      </ol>

      <div key={step} className="animate-rise">
        {step === 0 && (
          <div className="flex flex-col gap-6">
            <BasicsFields value={canteen} onChange={setCanteen} errors={canteenErrors} />
            <LogoField currentUrl={null} onFile={setLogo} />
          </div>
        )}
        {step === 1 && <HoursFields value={canteen} onChange={setCanteen} errors={canteenErrors} />}
        {step === 2 && (
          <div className="flex flex-col gap-4">
            <Field label="Your name" id="o-name" error={ownerErrors.name}>
              <Input {...fieldA11y("o-name", ownerErrors.name)} autoComplete="name" value={owner.name} onChange={(e) => setOwner({ ...owner, name: e.target.value })} />
            </Field>
            <Field label="Email" id="o-email" error={ownerErrors.email}>
              <Input {...fieldA11y("o-email", ownerErrors.email)} type="email" inputMode="email" autoComplete="email" value={owner.email} onChange={(e) => setOwner({ ...owner, email: e.target.value })} />
            </Field>
            <Field label="Password" id="o-password" error={ownerErrors.password} hint="At least 8 characters. You'll add kitchen and counter logins later.">
              <Input {...fieldA11y("o-password", ownerErrors.password, true)} type="password" autoComplete="new-password" value={owner.password} onChange={(e) => setOwner({ ...owner, password: e.target.value })} />
            </Field>
          </div>
        )}
      </div>

      <div className="mt-8 flex gap-3">
        {step > 0 && (
          <Button variant="outline" size="lg" onClick={() => setStep(step - 1)} disabled={pending}>
            Back
          </Button>
        )}
        <Button type="submit" variant={step === 2 ? "accent" : "ink"} size="lg" pending={pending} className="flex-1">
          {step === 2 ? (pending ? "Setting up" : "Open the canteen") : "Continue"}
        </Button>
      </div>
    </form>
  );
}

/** The canteen is validated before the owner, so field errors belong to one step. A lone "name" is the owner's if the canteen name is fine. */
function serverStepFor(keys: string[], canteenNameOk: boolean): number | null {
  if (keys.length === 0) return null;
  if (keys.some((k) => OWNER_FIELDS.has(k)) || (keys.length === 1 && keys[0] === "name" && canteenNameOk)) return 2;
  if (keys.some((k) => HOURS_FIELDS.has(k))) return 1;
  return 0;
}
