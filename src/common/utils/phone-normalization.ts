/**
 * Normalizes an Egyptian phone number to standard unified international format (+201XXXXXXXXX).
 * Strips whitespace, hyphens, and handles country prefixes (+20, 0020, 20, or leading 0).
 *
 * Examples:
 * "+201000000000" -> "+201000000000"
 * "00201000000000" -> "+201000000000"
 * "201000000000" -> "+201000000000"
 * "01000000000" -> "+201000000000"
 * "1000000000" -> "+201000000000"
 * "+20 100-000-0000" -> "+201000000000"
 *
 * Returns null if the phone number is invalid or does not match Egyptian phone patterns.
 */
export function normalizeEgyptianPhone(phone?: string | null): string | null {
  if (!phone || typeof phone !== "string") {
    return null;
  }
  const cleaned = phone.replace(/[\s-]/g, "");
  const match = cleaned.match(/^(?:\+20|0020|20|0)?(1[0125]\d{8})$/);
  if (!match) {
    return null;
  }
  return `+20${match[1]}`;
}

/**
 * Returns a masked version of a phone number showing only the last 3 digits for secure logging.
 * Example: "+201000000123" -> "***123"
 */
export function maskPhoneLast3(phone: string): string {
  if (!phone || typeof phone !== "string") {
    return "***";
  }
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 3) {
    return "***" + digits;
  }
  return "***" + digits.slice(-3);
}
