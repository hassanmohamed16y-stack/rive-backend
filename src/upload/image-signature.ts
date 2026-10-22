export type SupportedImageMime = "image/jpeg" | "image/png" | "image/webp";

/**
 * Detects JPEG / PNG / WEBP purely from the file's leading bytes.
 * Done natively (no ESM-only dependency) so validation can never fail because a
 * library could not be loaded in the serverless runtime.
 */
export function detectImageMime(buffer: Uint8Array | undefined): SupportedImageMime | undefined {
  if (!buffer || buffer.length < 12) return undefined;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((byte, i) => buffer[i] === byte)) return "image/png";

  const ascii = (start: number, end: number) =>
    String.fromCharCode(...Array.from(buffer.slice(start, end)));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";

  return undefined;
}
