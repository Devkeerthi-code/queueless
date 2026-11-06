import { describe, expect, it } from "vitest";
import { computeBill } from "@/lib/gst";
import { trayLines, trayTotal } from "@/components/student/tray";
import type { MenuItemView } from "@/server/views";

const item = (over: Partial<MenuItemView>): MenuItemView => ({
  id: "i1", name: "Item", category: "Snacks", isVeg: true, pricePaise: 1_500, priceIncludesGst: true, gstRateBp: 500,
  photoUrl: null, remaining: 50, isAvailable: true, prepMinutes: 2, gstCharged: true, ...over,
});

describe("student tray", () => {
  it("shows exactly what the invoice will charge, rounded to the rupee", () => {
    const soda = item({ id: "s", pricePaise: 3_400, priceIncludesGst: false, gstRateBp: 1_800 });
    const tea = item({ id: "t", pricePaise: 1_200 });
    const lines = trayLines({ s: 1, t: 1 }, [soda, tea]);
    const invoice = computeBill(
      lines.map((l) => ({ key: l.item.id, name: l.item.name, hsnSac: "", quantity: l.quantity, unitPricePaise: l.item.pricePaise, priceIncludesGst: l.item.priceIncludesGst, gstRateBp: l.item.gstRateBp })),
      "INTRA_STATE",
    );
    expect(trayTotal(lines)).toBe(invoice.totalPaise);
    expect(trayTotal(lines)).toBe(5_200); // 40.12 + 12.00 = 52.12, rounded to ₹52
  });

  it("adds no GST when the canteen isn't registered", () => {
    const soda = item({ id: "s", pricePaise: 3_400, priceIncludesGst: false, gstRateBp: 1_800, gstCharged: false });
    expect(trayTotal(trayLines({ s: 2 }, [soda]))).toBe(6_800);
  });

  it("clamps a stale tray to what is still in stock", () => {
    const samosa = item({ id: "x", remaining: 2 });
    const off = item({ id: "y", isAvailable: false });
    expect(trayLines({ x: 5, y: 1 }, [samosa, off])).toEqual([{ item: samosa, quantity: 2 }]);
  });
});
