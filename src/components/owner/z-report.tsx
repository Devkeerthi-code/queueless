import { formatBp, formatPaise } from "@/lib/money";
import { percent } from "@/lib/report-format";
import type { OwnerOverview } from "@/server/owner-views";

const Row = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
  <div className={`flex justify-between gap-3 ${strong ? "font-bold" : ""}`}>
    <span>{label}</span>
    <span>{value}</span>
  </div>
);

const Rule = () => <div className="my-2 border-t border-dashed border-line" aria-hidden="true" />;

/**
 * The day-end Z-report, printed like the till's own: today's totals, the month's GST by rate
 * (what GSTR-1 needs) and the range's no-shows. Monospace throughout so columns line up.
 */
export function ZReport({ data, csv }: { data: OwnerOverview; csv: { gst: string; waste: string } }) {
  const gst = data.gst;
  const sum = (k: "taxablePaise" | "cgstPaise" | "sgstPaise" | "igstPaise") => gst.reduce((s, r) => s + r[k], 0);
  return (
    <section aria-label="Day-end report" className="lift min-w-0">
      <div className="paper edge-torn-y px-5 font-mono text-[13px] leading-relaxed">
        <p className="pt-2 text-center font-semibold tracking-[0.2em]">*** Z REPORT ***</p>
        <p className="text-center text-[11px] text-ink-muted">DAY-END · {data.range.to}</p>
        <Rule />
        <Row label="SALES TODAY" value={formatPaise(data.today.salesPaise)} strong />
        <Row label="PROFIT (EX-GST)" value={formatPaise(data.today.profitPaise)} />
        <Row label="BILLS" value={String(data.today.invoices)} />
        <Row label="ORDERS" value={String(data.today.orders)} />
        <Row label="NO-SHOWS" value={String(data.today.noShows)} />
        <Row label="WASTED ITEMS" value={String(data.today.wastedUnits)} />
        <Rule />
        <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-muted">GST BY RATE · {data.month.label.toUpperCase()}</p>
        {gst.length === 0 ? (
          <p className="text-ink-muted">No tax invoices this month.</p>
        ) : (
          <table className="mt-1 w-full">
            <caption className="sr-only">GST by rate for {data.month.label}</caption>
            <thead className="text-[11px] text-ink-muted">
              <tr>
                <th scope="col" className="text-left font-medium">RATE</th>
                <th scope="col" className="text-right font-medium">TAXABLE</th>
                <th scope="col" className="text-right font-medium">CGST</th>
                <th scope="col" className="text-right font-medium">SGST</th>
              </tr>
            </thead>
            <tbody>
              {gst.map((r) => (
                <tr key={r.gstRateBp}>
                  <th scope="row" className="text-left font-semibold">{formatBp(r.gstRateBp)}</th>
                  <td className="text-right">{formatPaise(r.taxablePaise, { symbol: "" })}</td>
                  <td className="text-right">{formatPaise(r.cgstPaise, { symbol: "" })}</td>
                  <td className="text-right">{formatPaise(r.sgstPaise, { symbol: "" })}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="font-bold">
              <tr className="border-t border-dashed border-line">
                <th scope="row" className="text-left">TOTAL</th>
                <td className="text-right">{formatPaise(sum("taxablePaise"), { symbol: "" })}</td>
                <td className="text-right">{formatPaise(sum("cgstPaise"), { symbol: "" })}</td>
                <td className="text-right">{formatPaise(sum("sgstPaise"), { symbol: "" })}</td>
              </tr>
            </tfoot>
          </table>
        )}
        {sum("igstPaise") > 0 && <Row label="IGST" value={formatPaise(sum("igstPaise"))} />}
        <Rule />
        <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-muted">
          NO-SHOWS · {data.range.from} → {data.range.to}
        </p>
        <Row label="RATE" value={percent(data.noShows.rate)} strong />
        <Row label="NOT COLLECTED" value={`${data.noShows.noShows} / ${data.noShows.noShows + data.noShows.collected}`} />
        <Row label="FOOD WASTED" value={`${data.noShows.wastedUnits} · ${formatPaise(data.noShows.wastedCostPaise, { trimWhole: true })}`} />
        {data.waste.slice(0, 4).map((w) => (
          <Row key={w.name} label={`  ${w.name}`} value={`${w.units}×`} />
        ))}
        <Rule />
        <div className="flex justify-center gap-4 pb-2 text-[12px] font-semibold">
          <a href={csv.gst} download className="underline underline-offset-4 hover:text-accent-ink">
            GST CSV ↓
          </a>
          <a href={csv.waste} download className="underline underline-offset-4 hover:text-accent-ink">
            WASTE CSV ↓
          </a>
        </div>
        <p className="pb-1 text-center text-[11px] text-ink-muted">*** END OF REPORT ***</p>
      </div>
    </section>
  );
}
