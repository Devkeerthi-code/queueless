import { Skeleton } from "@/components/ui/skeleton";

export default function KitchenLoading() {
  return (
    <div className="night min-h-dvh" role="status" aria-label="Loading kitchen orders">
      <div className="flex items-center gap-6 border-b border-line px-6 py-4">
        <Skeleton className="h-12 w-40" />
        <Skeleton className="h-6 w-48" />
      </div>
      <div className="flex gap-4 overflow-hidden px-6 py-4">
        {[0, 1, 2].map((c) => (
          <div key={c} className="flex w-[min(86vw,360px)] shrink-0 flex-col gap-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
