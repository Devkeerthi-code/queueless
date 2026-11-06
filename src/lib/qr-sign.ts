import { createHmac, timingSafeEqual } from "node:crypto";

const VERSION = "QL1";

function signature(secret: string, orderId: string): string {
  return createHmac("sha256", secret).update(`${VERSION}:${orderId}`).digest("base64url").slice(0, 32);
}

/** The text encoded in a student's pickup QR: version, order id and an HMAC of both. */
export function signPickupCode(secret: string, orderId: string): string {
  if (!secret) throw new Error("QR signing secret is missing");
  return `${VERSION}.${orderId}.${signature(secret, orderId)}`;
}

/** Returns the order id if the code was signed with our secret, otherwise null. */
export function verifyPickupCode(secret: string, code: string): string | null {
  const parts = code.trim().split(".");
  if (parts.length !== 3 || parts[0] !== VERSION) return null;
  const [, orderId, given] = parts;
  if (!/^[a-z0-9]{10,40}$/.test(orderId)) return null;
  const expected = Buffer.from(signature(secret, orderId));
  const actual = Buffer.from(given);
  if (expected.length !== actual.length) return null;
  return timingSafeEqual(expected, actual) ? orderId : null;
}
