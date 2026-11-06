import "server-only";
import { prisma } from "./db";
import { UserError } from "./errors";

export const MAX_IMAGE_BYTES = 400_000;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

/** Checks the file's magic bytes, not just the browser-supplied type. */
function sniff(bytes: Uint8Array): string | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

/** Stored in Postgres because Vercel has no persistent disk; small photos only. */
export async function saveImage(file: File): Promise<string> {
  if (file.size > MAX_IMAGE_BYTES) throw new UserError("Photos must be under 400 KB. Try a smaller or compressed image.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniff(bytes);
  if (!mime || !ALLOWED.has(mime)) throw new UserError("Upload a PNG, JPEG or WebP image.");
  const image = await prisma.image.create({ data: { mime, data: bytes }, select: { id: true } });
  return image.id;
}
