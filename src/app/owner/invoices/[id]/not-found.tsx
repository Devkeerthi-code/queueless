import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function InvoiceNotFound() {
  return (
    <EmptyState title="That bill doesn't exist" action={<ButtonLink href="/owner/invoices">All bills</ButtonLink>}>
      It may have been mistyped, or it belongs to another canteen.
    </EmptyState>
  );
}
