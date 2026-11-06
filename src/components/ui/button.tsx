import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "./cn";

type Variant = "accent" | "ink" | "outline" | "quiet" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  accent: "bg-accent text-on-accent hover:brightness-95 disabled:bg-sunken disabled:text-ink-muted",
  ink: "bg-ink text-on-ink hover:bg-ink/90 disabled:bg-sunken disabled:text-ink-muted",
  outline: "border border-line bg-surface text-ink hover:border-ink/40 disabled:text-ink-muted",
  quiet: "text-ink hover:bg-sunken disabled:text-ink-muted",
  danger: "border border-danger/40 bg-surface text-danger hover:bg-danger-soft disabled:text-ink-muted",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-sm gap-1.5",
  md: "h-11 px-4 text-[15px] gap-2",
  lg: "h-14 px-5 text-base gap-2",
};

export function buttonClass(variant: Variant = "ink", size: Size = "md", extra?: string) {
  return cn(
    "press inline-flex select-none items-center justify-center whitespace-nowrap rounded-slip font-semibold disabled:cursor-not-allowed",
    VARIANTS[variant],
    SIZES[size],
    extra,
  );
}

type ButtonProps = ComponentProps<"button"> & { variant?: Variant; size?: Size; pending?: boolean };

export function Button({ variant, size, pending, className, children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} disabled={disabled || pending} aria-busy={pending || undefined} {...rest}>
      {pending && <Spinner />}
      {children}
    </button>
  );
}

export function ButtonLink({ variant, size, className, ...rest }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("size-4 animate-spin", className)} viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity=".25" strokeWidth="2" />
      <path d="M14 8a6 6 0 0 0-6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
