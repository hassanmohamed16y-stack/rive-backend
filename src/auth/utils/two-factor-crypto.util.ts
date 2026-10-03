import * as crypto from "crypto";

export function getTwoFactorEncryptionKey(
  rawKey: string | undefined = process.env.TWO_FACTOR_ENCRYPTION_KEY,
): Buffer | null {
  if (!rawKey || !rawKey.trim()) {
    return null;
  }

  const trimmed = rawKey.trim();

  // Try hex encoding (64 hex characters = 32 bytes)
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }

  // Try base64 decoding
  const base64Buf = Buffer.from(trimmed, "base64");
  if (base64Buf.length === 32) {
    return base64Buf;
  }

  // Try UTF-8 string (32 characters)
  const utf8Buf = Buffer.from(trimmed, "utf8");
  if (utf8Buf.length === 32) {
    return utf8Buf;
  }

  throw new Error(
    "TWO_FACTOR_ENCRYPTION_KEY must be exactly 32 bytes (64 hex chars, base64, or 32 raw bytes)",
  );
}

export function isTwoFactorConfigured(
  rawKey: string | undefined = process.env.TWO_FACTOR_ENCRYPTION_KEY,
): boolean {
  try {
    return getTwoFactorEncryptionKey(rawKey) !== null;
  } catch {
    return false;
  }
}

export function encryptTwoFactorSecret(
  secret: string,
  rawKey: string | undefined = process.env.TWO_FACTOR_ENCRYPTION_KEY,
): string {
  const key = getTwoFactorEncryptionKey(rawKey);
  if (!key) {
    throw new Error("Two-factor authentication is not configured");
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(secret, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return `v1:${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decryptTwoFactorSecret(
  encryptedStr: string,
  rawKey: string | undefined = process.env.TWO_FACTOR_ENCRYPTION_KEY,
): string {
  const key = getTwoFactorEncryptionKey(rawKey);
  if (!key) {
    throw new Error("Two-factor authentication is not configured");
  }

  const parts = encryptedStr.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Invalid encrypted TOTP secret format");
  }

  const iv = Buffer.from(parts[1], "hex");
  const authTag = Buffer.from(parts[2], "hex");
  const ciphertextHex = parts[3];

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertextHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
