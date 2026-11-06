import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function OrderNotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <EmptyState title="We can't find that token" action={<ButtonLink href="/orders">See my orders</ButtonLink>}>
        It may belong to another account, or the link is incomplete.
      </EmptyState>
    </div>
  );
}
