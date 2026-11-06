import { buttonClass } from "../ui/button";

/** PDFs open in a new tab, ready for the 80mm thermal printer or A4. */
export function PrintLinks({ invoiceId, kind = "invoices" }: { invoiceId: string; kind?: "invoices" | "credit-notes" }) {
  return (
    <div className="flex flex-wrap gap-2">
      <a href={`/api/${kind}/${invoiceId}/pdf?layout=thermal`} target="_blank" rel="noopener" className={buttonClass("ink", "md")}>
        Print 80mm receipt
      </a>
      <a href={`/api/${kind}/${invoiceId}/pdf?layout=a4`} target="_blank" rel="noopener" className={buttonClass("outline", "md")}>
        A4 PDF
      </a>
    </div>
  );
}
