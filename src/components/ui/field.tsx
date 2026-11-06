import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

export const inputClass =
  "h-11 w-full rounded-slip border border-line bg-surface px-3 text-[15px] text-ink placeholder:text-ink-muted/80 transition-colors hover:border-ink/30 focus:border-ink focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 aria-[invalid=true]:border-danger";

type FieldProps = { label: string; id: string; error?: string; hint?: ReactNode; children: ReactNode; className?: string };

/** Label, control, then either the error or the hint. Pair the control with `fieldA11y(id, error, hasHint)`. */
export function Field({ label, id, error, hint, children, className }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-msg`} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-msg`} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function fieldA11y(id: string, error?: string, hasHint = false) {
  return { id, "aria-invalid": error ? true : undefined, "aria-describedby": error || hasHint ? `${id}-msg` : undefined };
}

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input className={cn(inputClass, className)} {...rest} />;
}

const CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' fill='none' stroke='%236b655a' stroke-width='1.5'/%3E%3C/svg%3E")`;

export function Select({ className, ...rest }: ComponentProps<"select">) {
  return (
    <select
      className={cn(inputClass, "appearance-none bg-[length:12px] bg-[right_12px_center] bg-no-repeat pr-8", className)}
      style={{ backgroundImage: CHEVRON }}
      {...rest}
    />
  );
}

/** A switch is a checkbox with role="switch", so screen readers announce on/off. */
export function Switch({ label, className, ...rest }: Omit<ComponentProps<"input">, "type"> & { label: string }) {
  return (
    <label className={cn("inline-flex items-center gap-3 text-[15px]", className)}>
      <input type="checkbox" role="switch" className="peer sr-only" {...rest} />
      <span
        aria-hidden="true"
        className="relative h-6 w-10 shrink-0 rounded-full border border-line bg-sunken transition-colors peer-checked:border-ink peer-checked:bg-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink peer-disabled:opacity-50 after:absolute after:left-0.5 after:top-0.5 after:size-[18px] after:rounded-full after:bg-surface after:shadow-[0_1px_0_var(--line)] after:transition-transform after:duration-150 after:ease-spring peer-checked:after:translate-x-4"
      />
      <span>{label}</span>
    </label>
  );
}
