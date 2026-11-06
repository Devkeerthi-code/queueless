import { cn } from "./cn";

type Tone = "ink" | "accent" | "veg" | "danger" | "muted";

const TONES: Record<Tone, string> = {
  ink: "text-ink",
  accent: "text-accent-ink",
  veg: "text-veg",
  danger: "text-danger",
  muted: "text-ink-muted",
};

/** A rubber-stamp mark, e.g. READY or PAY FIRST. `land` plays the stamp-down motion on mount. */
export function Stamp({ children, tone = "ink", land = false, className }: { children: React.ReactNode; tone?: Tone; land?: boolean; className?: string }) {
  return <span className={cn("rubber-stamp", TONES[tone], land && "animate-stamp-big", !land && "-rotate-6", className)}>{children}</span>;
}
