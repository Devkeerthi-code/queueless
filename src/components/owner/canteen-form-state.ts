import { validateGstin } from "@/lib/gstin";

/** Form state keeps numbers as strings so half-typed values don't jump around. */
export type CanteenFormState = {
  name: string;
  address: string;
  gstRegistered: boolean;
  gstin: string;
  stateCode: string;
  invoicePrefix: string;
  upiVpa: string;
  open: string;
  close: string;
  openDays: number[];
  slotMinutes: string;
  maxOrdersPerSlot: string;
  orderCutoffMinutes: string;
  noShowGraceMinutes: string;
  noShowThreshold: string;
};

export const DEFAULT_CANTEEN: CanteenFormState = {
  name: "",
  address: "",
  gstRegistered: false,
  gstin: "",
  stateCode: "",
  invoicePrefix: "QL",
  upiVpa: "",
  open: "08:00",
  close: "16:00",
  openDays: [1, 2, 3, 4, 5, 6],
  slotMinutes: "15",
  maxOrdersPerSlot: "25",
  orderCutoffMinutes: "10",
  noShowGraceMinutes: "30",
  noShowThreshold: "3",
};

export type CanteenValues = {
  name: string; address: string; gstRegistered: boolean; gstin: string; stateCode: string; invoicePrefix: string; upiVpa: string;
  open: string; close: string; openDays: number[]; slotMinutes: number; maxOrdersPerSlot: number; orderCutoffMinutes: number;
  noShowGraceMinutes: number; noShowThreshold: number;
};

export function fromValues(v: CanteenValues): CanteenFormState {
  return {
    ...v,
    slotMinutes: String(v.slotMinutes),
    maxOrdersPerSlot: String(v.maxOrdersPerSlot),
    orderCutoffMinutes: String(v.orderCutoffMinutes),
    noShowGraceMinutes: String(v.noShowGraceMinutes),
    noShowThreshold: String(v.noShowThreshold),
  };
}

/** The JSON the server's canteen schema expects. The server validates everything again. */
export function toPayload(s: CanteenFormState): CanteenValues {
  return {
    ...s,
    gstin: s.gstRegistered ? s.gstin.trim().toUpperCase() : "",
    slotMinutes: Number(s.slotMinutes),
    maxOrdersPerSlot: Number(s.maxOrdersPerSlot),
    orderCutoffMinutes: Number(s.orderCutoffMinutes),
    noShowGraceMinutes: Number(s.noShowGraceMinutes),
    noShowThreshold: Number(s.noShowThreshold),
  };
}

/** Live hint under the GSTIN box, so typos are caught before submitting. */
export function gstinHint(raw: string): { tone: "muted" | "ok" | "bad"; text: string } {
  const v = raw.trim();
  if (v.length === 0) return { tone: "muted", text: "15 characters, printed on your GST certificate." };
  if (v.length < 15) return { tone: "muted", text: `${v.length} of 15 characters` };
  const check = validateGstin(v);
  return check.ok ? { tone: "ok", text: "Checksum matches." } : { tone: "bad", text: check.reason };
}

export function basicsErrors(s: CanteenFormState): Record<string, string> {
  const e: Record<string, string> = {};
  if (s.name.trim().length < 2) e.name = "Enter the canteen's name.";
  if (s.address.trim().length < 5) e.address = "Enter the address printed on bills.";
  if (!s.stateCode) e.stateCode = "Pick the state the canteen is in.";
  if (s.gstRegistered && !validateGstin(s.gstin).ok) e.gstin = "Fix the GSTIN first.";
  if (!/^[A-Za-z0-9]{1,4}$/.test(s.invoicePrefix.trim())) e.invoicePrefix = "Use 1 to 4 letters or digits.";
  return e;
}
