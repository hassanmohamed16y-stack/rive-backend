/**
 * Encodes digits-only phone number into a stable, URL-safe base64url conversation key.
 */
export function encodeConversationKey(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return Buffer.from(digits, "utf8").toString("base64url");
}

/**
 * Decodes a conversation key back to a phone string (digits only).
 */
export function decodeConversationKey(key: string): string {
  try {
    const decoded = Buffer.from(key, "base64url").toString("utf8");
    return decoded;
  } catch {
    return "";
  }
}

/**
 * Validates whether a phone string contains strictly 8 to 15 numeric digits.
 */
export function isValidPhone(digits: string): boolean {
  return /^\d{8,15}$/.test(digits);
}

/**
 * Formats phone number into a masked display format (e.g., "+20 11 ••• ••77").
 * Also safe for logging (ensures raw full phone number is never exposed).
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");

  if (digits.length < 4) {
    return "•".repeat(digits.length);
  }

  const country = digits.length > 10 ? `+${digits.slice(0, 2)} ${digits.slice(2, 4)}` : `+${digits.slice(0, 2)}`;
  const tail = digits.slice(-2);
  const middleLength = digits.length - (digits.length > 10 ? 6 : 4);

  let middleMask = "•••";
  if (middleLength > 4) {
    middleMask = "••• ••";
  } else if (middleLength > 0) {
    middleMask = "•".repeat(middleLength);
  }

  return `${country} ${middleMask}${tail}`;
}
