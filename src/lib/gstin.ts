/** GST state codes as published on the GST portal. */
export const GST_STATES: Record<string, string> = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
  "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
  "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
  "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu", "27": "Maharashtra", "29": "Karnataka",
  "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
  "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
  "97": "Other Territory",
};

const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const SHAPE = /^(\d{2})([A-Z]{5}\d{4}[A-Z])([1-9A-Z])Z([0-9A-Z])$/;

/** The 15th character of a GSTIN is a mod-36 checksum over the first 14. */
export function gstinChecksum(first14: string): string {
  let total = 0;
  for (let i = 0; i < 14; i++) {
    const value = CHARS.indexOf(first14[i]);
    if (value < 0) throw new Error("invalid character");
    const product = value * (i % 2 === 0 ? 1 : 2);
    total += Math.floor(product / 36) + (product % 36);
  }
  return CHARS[(36 - (total % 36)) % 36];
}

export type GstinCheck = { ok: true; stateCode: string } | { ok: false; reason: string };

export function validateGstin(raw: string): GstinCheck {
  const gstin = raw.trim().toUpperCase();
  const match = SHAPE.exec(gstin);
  if (!match) {
    return { ok: false, reason: "A GSTIN is 15 characters: 2-digit state code, 10-character PAN, entity number, Z, checksum." };
  }
  const stateCode = match[1];
  if (!GST_STATES[stateCode]) return { ok: false, reason: `${stateCode} is not a GST state code.` };
  if (gstinChecksum(gstin.slice(0, 14)) !== gstin[14]) {
    return { ok: false, reason: "The last character (checksum) doesn't match. Check for a typo." };
  }
  return { ok: true, stateCode };
}
