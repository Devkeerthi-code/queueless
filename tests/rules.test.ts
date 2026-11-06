import { describe, expect, it } from "vitest";
import { canRestock, creditAmounts } from "@/lib/credit";
import { parseCsv, toCsv } from "@/lib/csv";
import { formatDocNumber, MAX_DOC_NUMBER_LENGTH } from "@/lib/doc-number";
import { gstinChecksum, validateGstin } from "@/lib/gstin";
import { formatPaise, parsePercentToBp, parseRupees, roundDiv, roundToRupee } from "@/lib/money";
import { effectiveStatus, isWasted, mustPrepay } from "@/lib/noshow";
import { can, type Action, type Role } from "@/lib/permissions";
import { signPickupCode, verifyPickupCode } from "@/lib/qr-sign";
import { findSlot, isSlotBookable, slotsForDay } from "@/lib/slots";
import { businessDate, financialYear, istInstant } from "@/lib/time";
import { formatToken, normaliseToken } from "@/lib/token";

describe("money", () => {
  it("rounds half away from zero", () => {
    expect(roundDiv(5, 10)).toBe(1);
    expect(roundDiv(4, 10)).toBe(0);
    expect(roundDiv(-5, 10)).toBe(-1);
    expect(roundToRupee(1_049)).toBe(1_000);
    expect(roundToRupee(1_050)).toBe(1_100);
  });
  it("parses rupees and percentages into integers without floats", () => {
    expect(parseRupees("45")).toBe(4_500);
    expect(parseRupees("₹1,234.5")).toBe(123_450);
    expect(parseRupees("0.07")).toBe(7);
    expect(parseRupees("12.345")).toBeNull();
    expect(parseRupees("-3")).toBeNull();
    expect(parsePercentToBp("5")).toBe(500);
    expect(parsePercentToBp("2.5%")).toBe(250);
  });
  it("formats in the Indian grouping", () => {
    expect(formatPaise(12_345_678)).toBe("₹1,23,456.78");
    expect(formatPaise(4_500, { trimWhole: true })).toBe("₹45");
  });
});

describe("GSTIN", () => {
  it("accepts a valid GSTIN and returns its state", () => {
    expect(validateGstin("27AAPFU0939F1ZV")).toEqual({ ok: true, stateCode: "27" });
    expect(validateGstin(" 27aapfu0939f1zv ")).toEqual({ ok: true, stateCode: "27" });
  });
  it("rejects bad shape, unknown state and wrong checksum", () => {
    expect(validateGstin("27AAPFU0939F1Z").ok).toBe(false);
    expect(validateGstin("99AAPFU0939F1ZV").ok).toBe(false);
    expect(validateGstin("27AAPFU0939F1ZW").ok).toBe(false);
  });
  it("computes the checksum for any 14-character body", () => {
    const body = "33ABCDE1234F1Z";
    expect(validateGstin(body + gstinChecksum(body)).ok).toBe(true);
  });
});

describe("financial year and IST", () => {
  it("rolls over on 1 April IST, not UTC", () => {
    expect(financialYear(new Date("2027-03-31T18:29:59Z"))).toBe("2026-27"); // 23:59:59 IST on 31 Mar
    expect(financialYear(new Date("2027-03-31T18:30:00Z"))).toBe("2027-28"); // 00:00 IST on 1 Apr
    expect(financialYear(new Date("2026-11-06T06:00:00Z"))).toBe("2026-27");
    expect(financialYear(new Date("2027-01-15T06:00:00Z"))).toBe("2026-27");
  });
  it("puts 1 am IST on the IST date, not the UTC one", () => {
    expect(businessDate(new Date("2026-11-05T19:30:00Z")).toISOString()).toBe("2026-11-06T00:00:00.000Z");
  });
});

describe("document numbers", () => {
  it("fits GST's 16-character limit and separates series", () => {
    expect(formatDocNumber("QL", "INV", "2026-27", 42)).toBe("QL/2627/00042");
    expect(formatDocNumber("QL", "BOS", "2026-27", 1)).toBe("QLB/2627/00001");
    const longest = formatDocNumber("ABCD", "CN", "2026-27", 99_999);
    expect(longest.length).toBeLessThanOrEqual(MAX_DOC_NUMBER_LENGTH);
    expect(() => formatDocNumber("ab/c", "INV", "2026-27", 1)).toThrow();
  });
});

describe("tokens", () => {
  it("counts A1..A99 then B1", () => {
    expect(formatToken(1)).toBe("A1");
    expect(formatToken(23)).toBe("A23");
    expect(formatToken(99)).toBe("A99");
    expect(formatToken(100)).toBe("B1");
    expect(normaliseToken(" a 23")).toBe("A23");
  });
});

describe("pickup QR signature", () => {
  const secret = "test-secret-that-is-long-enough-123456";
  const orderId = "cmabc123def456ghi789";
  it("verifies its own codes", () => {
    expect(verifyPickupCode(secret, signPickupCode(secret, orderId))).toBe(orderId);
  });
  it("rejects tampered ids, signatures, other secrets and junk", () => {
    const code = signPickupCode(secret, orderId);
    const [v, id, sig] = code.split(".");
    expect(verifyPickupCode(secret, `${v}.${id.replace(/.$/, "x")}.${sig}`)).toBeNull();
    expect(verifyPickupCode(secret, `${v}.${id}.${sig.replace(/^./, sig[0] === "A" ? "B" : "A")}`)).toBeNull();
    expect(verifyPickupCode("another-secret-also-long-enough-9876", code)).toBeNull();
    expect(verifyPickupCode(secret, "A23")).toBeNull();
    expect(verifyPickupCode(secret, `${v}.${id}.`)).toBeNull();
  });
});

describe("pickup slots", () => {
  const day = new Date("2026-11-06T00:00:00Z"); // a Friday
  const rules = { openMinute: 12 * 60, closeMinute: 13 * 60, openDays: [1, 2, 3, 4, 5], slotMinutes: 15, orderCutoffMinutes: 10 };
  it("generates back-to-back slots inside opening hours", () => {
    const slots = slotsForDay(day, rules);
    expect(slots).toHaveLength(4);
    expect(slots[0].startsAt.toISOString()).toBe("2026-11-06T06:30:00.000Z"); // 12:00 IST
  });
  it("is closed on days off", () => {
    expect(slotsForDay(new Date("2026-11-08T00:00:00Z"), rules)).toEqual([]);
  });
  it("stops taking orders N minutes before the slot", () => {
    const start = istInstant(day, 12 * 60 + 30);
    expect(isSlotBookable(start, new Date(start.getTime() - 10 * 60_000), rules)).toBe(true);
    expect(isSlotBookable(start, new Date(start.getTime() - 9 * 60_000), rules)).toBe(false);
  });
  it("rejects made-up slot times", () => {
    expect(findSlot(day, istInstant(day, 12 * 60 + 7), rules)).toBeNull();
  });
});

describe("no-show rules", () => {
  const slotEnd = new Date("2026-11-06T07:00:00Z");
  it("becomes a no-show only after the grace period, and only while uncollected", () => {
    expect(effectiveStatus("READY", slotEnd, new Date(slotEnd.getTime() + 30 * 60_000), 30)).toBe("READY");
    expect(effectiveStatus("READY", slotEnd, new Date(slotEnd.getTime() + 31 * 60_000), 30)).toBe("NO_SHOW");
    expect(effectiveStatus("COLLECTED", slotEnd, new Date(slotEnd.getTime() + 999 * 60_000), 30)).toBe("COLLECTED");
    expect(effectiveStatus("PLACED", null, new Date(slotEnd.getTime() + 999 * 60_000), 30)).toBe("PLACED");
  });
  it("requires pre-payment from the threshold onwards, and never when disabled", () => {
    expect(mustPrepay(1, 2)).toBe(false);
    expect(mustPrepay(2, 2)).toBe(true);
    expect(mustPrepay(10, 0)).toBe(false);
  });
  it("counts food as wasted only if the kitchen had started it", () => {
    expect(isWasted({ status: "NO_SHOW", preparingAt: new Date() })).toBe(true);
    expect(isWasted({ status: "NO_SHOW", preparingAt: null })).toBe(false);
  });
});

describe("role permissions", () => {
  const ownerOnly: Action[] = ["menu:edit", "canteen:edit", "invoice:credit-note", "staff:manage", "reports:view"];
  it.each(["COUNTER", "KITCHEN", "STUDENT"] as Role[])("%s can't edit prices, menu or cancel invoices", (role) => {
    for (const action of ownerOnly) expect(can(role, action)).toBe(false);
  });
  it("lets each role do its job", () => {
    expect(can("OWNER", "menu:edit")).toBe(true);
    expect(can("KITCHEN", "kitchen:advance")).toBe(true);
    expect(can("KITCHEN", "counter:collect")).toBe(false);
    expect(can("COUNTER", "counter:collect")).toBe(true);
    expect(can("COUNTER", "kitchen:advance")).toBe(false);
    expect(can("STUDENT", "order:place")).toBe(true);
    expect(can("STUDENT", "order:cancel-any")).toBe(false);
  });
});

describe("credit amounts", () => {
  const line = { quantity: 3, taxablePaise: 12_857, cgstPaise: 322, sgstPaise: 322, igstPaise: 0, totalPaise: 13_500 };
  const zero = { taxablePaise: 0, cgstPaise: 0, sgstPaise: 0, igstPaise: 0, totalPaise: 0 };
  it("adds up exactly across partial returns", () => {
    const first = creditAmounts(line, 0, zero, 1);
    const second = creditAmounts(line, 1, first, 2);
    expect(first.totalPaise + second.totalPaise).toBe(13_500);
    expect(first.taxablePaise + second.taxablePaise).toBe(12_857);
    expect(first.cgstPaise + second.cgstPaise).toBe(322);
  });
  it("refuses to credit more than was invoiced", () => {
    expect(() => creditAmounts(line, 2, zero, 2)).toThrow();
  });
  it("restocks only unprepared food from the same day", () => {
    const today = new Date("2026-11-06T00:00:00Z");
    expect(canRestock({ preparingAt: null, businessDate: today }, today)).toBe(true);
    expect(canRestock({ preparingAt: new Date(), businessDate: today }, today)).toBe(false);
    expect(canRestock({ preparingAt: null, businessDate: new Date("2026-11-05T00:00:00Z") }, today)).toBe(false);
  });
});

describe("CSV", () => {
  it("parses quotes, commas, escaped quotes and CRLF", () => {
    expect(parseCsv('name,price\r\n"Dosa, masala",45\r\n"Say ""hi""",10\n')).toEqual([
      ["name", "price"],
      ["Dosa, masala", "45"],
      ['Say "hi"', "10"],
    ]);
  });
  it("round-trips and neutralises spreadsheet formulas", () => {
    const csv = toCsv(["a", "b"], [["=HYPERLINK(1)", -45], ['x"y', null]]);
    expect(csv).toBe(`a,b\r\n'=HYPERLINK(1),-45\r\n"x""y",\r\n`);
  });
});
