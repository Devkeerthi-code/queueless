import { Skeleton } from "@/components/ui/skeleton";

export default function CounterLoading() {
  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 pt-5 lg:grid-cols-[360px_minmax(0,1fr)_280px]" role="status" aria-label="Loading counter">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="aspect-[4/3] w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
      <Skeleton className="h-80 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
