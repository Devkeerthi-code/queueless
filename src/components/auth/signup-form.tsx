"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signupAction } from "@/app/actions/auth";
import { Button } from "../ui/button";
import { Field, fieldA11y, Input } from "../ui/field";
import { useAction } from "../use-action";

export function SignupForm() {
  const router = useRouter();
  const { run, pending, fields } = useAction();
  const [torn, setTorn] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    run(() => signupAction(form), { onOk: ({ home }) => {
        setTorn(true);
        router.replace(home);
      },
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate data-torn={torn || undefined}>
      <Field label="Your name" id="name" error={fields.name} hint="The counter calls this out with your token.">
        <Input {...fieldA11y("name", fields.name, true)} autoComplete="name" required value={form.name} onChange={set("name")} />
      </Field>
      <Field label="Email" id="email" error={fields.email}>
        <Input {...fieldA11y("email", fields.email)} type="email" inputMode="email" autoComplete="email" required value={form.email} onChange={set("email")} />
      </Field>
      <Field label="Password" id="password" error={fields.password} hint="At least 8 characters.">
        <Input {...fieldA11y("password", fields.password, true)} type="password" autoComplete="new-password" minLength={8} required value={form.password} onChange={set("password")} />
      </Field>
      <Button type="submit" variant="accent" size="lg" pending={pending} className="mt-2">
        {pending ? "Creating account" : "Create account"}
      </Button>
      <p className="text-center text-sm text-ink-muted">
        Already have one?{" "}
        <Link href="/login" className="font-semibold text-ink underline underline-offset-4">
          Log in
        </Link>
      </p>
    </form>
  );
}
