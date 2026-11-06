import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[80dvh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="slip perforated w-56 px-6 py-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-muted">Token</p>
        <p className="num condensed text-8xl font-extrabold leading-none">404</p>
      </div>
      <h1 className="condensed mt-4 text-4xl font-extrabold">No such counter</h1>
      <p className="text-ink-muted">This page doesn&apos;t exist. The menu does.</p>
      <ButtonLink href="/" variant="accent">
        Go to QueueLess
      </ButtonLink>
    </main>
  );
}
