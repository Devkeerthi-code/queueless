"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateCanteenAction } from "@/app/actions/owner";
import { Button } from "../ui/button";
import { useAction } from "../use-action";
import { BasicsFields, HoursFields, LogoField } from "./canteen-fields";
import { fromValues, toPayload, type CanteenValues } from "./canteen-form-state";

export function SettingsForm({ values, logoUrl }: { values: CanteenValues; logoUrl: string | null }) {
  const router = useRouter();
  const [state, setState] = useState(() => fromValues(values));
  const [logo, setLogo] = useState<File | null>(null);
  const { run, pending, fields } = useAction();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const form = new FormData();
    form.set("canteen", JSON.stringify(toPayload(state)));
    if (logo) form.set("logo", logo);
    run(() => updateCanteenAction(form), { success: "Settings saved. New orders use them right away.", onOk: () => router.refresh() });
  }

  return (
    <form onSubmit={submit} noValidate className="flex max-w-3xl flex-col gap-8">
      <Section title="Canteen and billing">
        <BasicsFields value={state} onChange={setState} errors={fields} />
        <div className="mt-6">
          <LogoField currentUrl={logoUrl} onFile={setLogo} />
        </div>
      </Section>
      <Section title="Hours, slots and no-shows">
        <HoursFields value={state} onChange={setState} errors={fields} />
      </Section>
      <div className="sticky bottom-20 z-10 flex justify-end lg:bottom-4">
        <Button type="submit" variant="ink" size="lg" pending={pending} className="shadow-[0_8px_24px_rgb(0_0_0/0.15)]">
          {pending ? "Saving" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="slip p-5" aria-label={title}>
      <h2 className="mb-5 text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">{title}</h2>
      {children}
    </section>
  );
}
