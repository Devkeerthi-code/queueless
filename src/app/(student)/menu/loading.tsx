import { Skeleton } from "@/components/ui/skeleton";

export default function MenuLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-5 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10" role="status" aria-label="Loading today's menu">
      <div className="flex flex-col gap-5">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-28 w-full" />
        <div className="flex gap-2">
          {[64, 80, 72, 88].map((w) => (
            <Skeleton key={w} className="h-9 rounded-full" style={{ width: w }} />
          ))}
        </div>
        <div className="slip divide-y divide-line px-4">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 py-3">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-10 w-20" />
            </div>
          ))}
        </div>
      </div>
      <Skeleton className="hidden h-64 lg:block" />
    </div>
  );
}
