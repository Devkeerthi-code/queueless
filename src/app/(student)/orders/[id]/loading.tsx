import { Skeleton } from "@/components/ui/skeleton";

export default function TokenLoading() {
  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 pt-5 lg:grid-cols-[400px_minmax(0,1fr)] lg:gap-12" role="status" aria-label="Loading your token">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-[520px] w-full" />
      </div>
      <div className="flex flex-col gap-5 lg:pt-10">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    </div>
  );
}
