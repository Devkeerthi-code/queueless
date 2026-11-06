import { Skeleton } from "@/components/ui/skeleton";

export default function OwnerLoading() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Loading">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-20 w-full" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Skeleton className="h-72 xl:col-span-2" />
        <Skeleton className="h-72" />
        <Skeleton className="h-56 xl:col-span-2" />
        <Skeleton className="h-56" />
      </div>
    </div>
  );
}
