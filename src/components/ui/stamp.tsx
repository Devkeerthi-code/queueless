import { cn } from "./cn";

type Tone = "ink" | "violet" | "veg" | "danger" | "muted";

const TONES: Record<Tone, string> = {
  ink: "text-ink",
  violet: "text-stamp",
  veg: "text-veg",
  danger: "text-danger",
  muted: "text-ink-muted",
};

/** A rubber-stamp mark in stamp-pad ink, e.g. READY, FULL or PAY FIRST. `land` plays the stamp-down motion on mount. */
export function Stamp({ children, tone = "violet", land = false, className }: { children: React.ReactNode; tone?: Tone; land?: boolean; className?: string }) {
  return <span className={cn("rubber-stamp", TONES[tone], land ? "animate-stamp-big" : "-rotate-6", className)}>{children}</span>;
}
