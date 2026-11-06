import { cn } from "./cn";

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn("skeleton", className)} style={style} aria-hidden="true" />;
}

/** Generic list-page skeleton: a title, a summary block and rows shaped like the real list. */
export function PageSkeleton({ rows = 6, label }: { rows?: number; label: string }) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-6" role="status" aria-label={label}>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-24 w-full" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}
