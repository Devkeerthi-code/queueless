"use client";

import { Button, ButtonLink } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="rubber-stamp -rotate-6 text-2xl text-danger">Jammed</span>
      <h1 className="condensed text-4xl font-extrabold">Something went wrong</h1>
      <p className="text-ink-muted">The page couldn&apos;t load. Your orders are safe. Try again, and if it keeps happening, tell the counter.</p>
      <div className="flex gap-2">
        <Button variant="ink" onClick={reset}>
          Try again
        </Button>
        <ButtonLink href="/" variant="outline">
          Home
        </ButtonLink>
      </div>
    </main>
  );
}
