"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { loginAction } from "@/app/actions/auth";
import { Button } from "../ui/button";
import { Field, fieldA11y, Input } from "../ui/field";
import { useAction } from "../use-action";

export function LoginForm({ initialEmail, demoPassword }: { initialEmail: string; demoPassword: string }) {
  const router = useRouter();
  const { run, pending, fields } = useAction();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState(initialEmail.endsWith("@demo.queueless.in") ? demoPassword : "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    run(() => loginAction({ email, password }), { onOk: ({ home }) => router.replace(home) });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field label="Email" id="email" error={fields.email}>
        <Input {...fieldA11y("email", fields.email)} type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Password" id="password" error={fields.password}>
        <Input {...fieldA11y("password", fields.password)} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Button type="submit" variant="ink" size="lg" pending={pending} className="mt-2">
        {pending ? "Logging in" : "Log in"}
      </Button>
      <p className="text-center text-sm text-ink-muted">
        Student without an account?{" "}
        <Link href="/signup" className="font-semibold text-ink underline underline-offset-4">
          Create one
        </Link>
      </p>
    </form>
  );
}
