import { readImageUriAsBase64 } from "@/lib/image-base64";

/** Remove data-URL prefix if present; vision APIs want raw base64 only. */
export function stripBase64Payload(input: string): string {
  const t = input.trim();
  const m = t.match(/^data:image\/[^;]+;base64,([\s\S]+)$/i);
  return (m ? m[1] : t).replace(/\s/g, "");
}

export type VisionMime = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

/** OpenAI vision accepts jpeg, png, gif, webp — not HEIC. */
export function detectVisionMimeFromBase64(b64: string): VisionMime | "unsupported" {
  const clean = b64.replace(/\s/g, "");
  const head = clean.slice(0, 28);
  if (head.startsWith("/9j")) return "image/jpeg";
  if (head.startsWith("iVBORw0KGgo")) return "image/png";
  if (head.startsWith("R0lGOD")) return "image/gif";
  if (head.startsWith("UklGR")) return "image/webp";
  if (isLikelyHeicOrHeif(clean)) return "unsupported";
  return "image/jpeg";
}

function isLikelyHeicOrHeif(cleanB64: string): boolean {
  try {
    const chunk = cleanB64.slice(0, 48);
    const pad = chunk.length % 4 === 0 ? "" : "=".repeat(4 - (chunk.length % 4));
    const bin = atob(chunk + pad);
    if (bin.length < 12) return false;
    return (
      bin.includes("ftyp") &&
      (bin.includes("heic") ||
        bin.includes("heix") ||
        bin.includes("hevc") ||
        bin.includes("mif1") ||
        bin.includes("msf1"))
    );
  } catch {
    return false;
  }
}

/** Full data URL for OpenAI `image_url`; null if HEIC/empty. */
export function visionDataUrlForOpenAI(b64: string): string | null {
  const clean = stripBase64Payload(b64).replace(/\s/g, "");
  if (clean.length < 80) return null;
  const mime = detectVisionMimeFromBase64(clean);
  if (mime === "unsupported") return null;
  return `data:${mime};base64,${clean}`;
}

export type VisionResolve =
  | { ok: true; base64: string }
  | { ok: false; reason: "unreadable" | "heic" };

/**
 * Picker base64 and/or file read — no native image-manipulator (avoids extra rebuilds).
 */
export async function resolveBase64ForVision(
  uri: string,
  pickerBase64: string | null,
): Promise<VisionResolve> {
  let raw = pickerBase64?.trim() || null;
  if (!raw) raw = await readImageUriAsBase64(uri);
  if (!raw) return { ok: false, reason: "unreadable" };
  const base64 = stripBase64Payload(raw).replace(/\s/g, "");
  if (base64.length < 80) return { ok: false, reason: "unreadable" };
  if (detectVisionMimeFromBase64(base64) === "unsupported") {
    return { ok: false, reason: "heic" };
  }
  return { ok: true, base64 };
}
