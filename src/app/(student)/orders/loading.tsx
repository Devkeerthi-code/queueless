import { PageSkeleton } from "@/components/ui/skeleton";

export default function OrdersLoading() {
  return <PageSkeleton label="Loading your orders" rows={6} />;
}
