import { cn } from "./cn";

/** FSSAI marks: green square with a dot for veg, brown square with a triangle for non-veg. */
export function VegMark({ isVeg, className }: { isVeg: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={cn("size-4 shrink-0", isVeg ? "text-veg" : "text-nonveg", className)}
      role="img"
      aria-label={isVeg ? "Veg" : "Non-veg"}
    >
      <rect x="1" y="1" width="14" height="14" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      {isVeg ? <circle cx="8" cy="8" r="3.6" fill="currentColor" /> : <path d="M8 4l4.2 7.4H3.8z" fill="currentColor" />}
    </svg>
  );
}
