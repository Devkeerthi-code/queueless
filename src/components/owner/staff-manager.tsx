"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { addStaffAction, removeStaffAction } from "@/app/actions/owner";
import { Button } from "../ui/button";
import { Field, fieldA11y, Input } from "../ui/field";
import { useAction } from "../use-action";
import { Panel } from "./page-title";

type Staff = { id: string; name: string; email: string; role: string };
type NewStaff = { name: string; email: string; password: string; role: "COUNTER" | "KITCHEN" };

const ROLE: Record<string, string> = { OWNER: "Owner", COUNTER: "Counter", KITCHEN: "Kitchen" };
const EMPTY: NewStaff = { name: "", email: "", password: "", role: "COUNTER" };

export function StaffManager({ staff, selfId }: { staff: Staff[]; selfId: string }) {
  const router = useRouter();
  const [form, setForm] = useState<NewStaff>(EMPTY);
  const add = useAction();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    add.run(() => addStaffAction(form), {
      success: `${form.name} can log in now`,
      onOk: () => {
        setForm(EMPTY);
        router.refresh();
      },
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
      <Panel title="Staff passes">
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {staff.map((s) => (
            <li key={s.id} className="punched flex items-center gap-3 rounded-[3px] bg-sunken px-4 pb-3 pt-8">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sunken text-sm font-bold" aria-hidden="true">
                {s.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">
                  {s.name}
                  {s.id === selfId && <span className="font-normal text-ink-muted"> (you)</span>}
                </span>
                <span className="block truncate font-mono text-xs text-ink-muted">{s.email}</span>
              </span>
              <span className="rubber-stamp -rotate-6 text-[10px] text-stamp">{ROLE[s.role] ?? s.role}</span>
              {s.role !== "OWNER" && <RemoveButton staff={s} onDone={() => router.refresh()} />}
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Issue a new pass" edge="perf">
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Works at</legend>
            <div className="grid grid-cols-2 gap-2">
              {(["COUNTER", "KITCHEN"] as const).map((r) => (
                <label key={r} className="press">
                  <input type="radio" name="staff-role" className="peer sr-only" checked={form.role === r} onChange={() => setForm({ ...form, role: r })} />
                  <span className="flex h-11 items-center justify-center rounded-slip border border-line text-sm font-semibold peer-checked:border-ink peer-checked:bg-ink peer-checked:text-on-ink peer-focus-visible:outline-2 peer-focus-visible:outline-ink">
                    {ROLE[r]}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Name" id="s-name" error={add.fields.name}>
            <Input {...fieldA11y("s-name", add.fields.name)} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Email (their login)" id="s-email" error={add.fields.email}>
            <Input {...fieldA11y("s-email", add.fields.email)} type="email" inputMode="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Starting password" id="s-password" error={add.fields.password} hint="At least 8 characters. Share it with them in person.">
            <Input {...fieldA11y("s-password", add.fields.password, true)} type="text" autoComplete="off" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <Button type="submit" variant="ink" size="lg" pending={add.pending}>
            Add {ROLE[form.role].toLowerCase()} login
          </Button>
        </form>
      </Panel>
    </div>
  );
}

function RemoveButton({ staff, onDone }: { staff: Staff; onDone: () => void }) {
  const { run, pending } = useAction();
  const [armed, setArmed] = useState(false);
  return (
    <Button
      variant={armed ? "danger" : "quiet"}
      size="sm"
      pending={pending}
      onBlur={() => setArmed(false)}
      onClick={() => {
        if (!armed) return setArmed(true);
        run(() => removeStaffAction(staff.id), { success: `${staff.name} removed`, onOk: onDone });
      }}
      aria-label={armed ? `Confirm removing ${staff.name}` : `Remove ${staff.name}`}
    >
      {armed ? "Confirm" : "Remove"}
    </Button>
  );
}
