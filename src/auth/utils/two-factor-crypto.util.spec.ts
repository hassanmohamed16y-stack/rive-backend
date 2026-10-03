import * as crypto from "crypto";
import {
  decryptTwoFactorSecret,
  encryptTwoFactorSecret,
  getTwoFactorEncryptionKey,
  isTwoFactorConfigured,
} from "./two-factor-crypto.util";

describe("TwoFactorCryptoUtil", () => {
  const validHexKey = crypto.randomBytes(32).toString("hex"); // 64 chars
  const validBase64Key = crypto.randomBytes(32).toString("base64");
  const validUtf8Key = "12345678901234567890123456789012"; // 32 bytes

  it("parses valid 32-byte keys in hex, base64, and utf8 formats", () => {
    expect(getTwoFactorEncryptionKey(validHexKey)).toHaveLength(32);
    expect(getTwoFactorEncryptionKey(validBase64Key)).toHaveLength(32);
    expect(getTwoFactorEncryptionKey(validUtf8Key)).toHaveLength(32);
  });

  it("returns null when key is missing or empty", () => {
    expect(getTwoFactorEncryptionKey(undefined)).toBeNull();
    expect(getTwoFactorEncryptionKey("")).toBeNull();
    expect(getTwoFactorEncryptionKey("   ")).toBeNull();
    expect(isTwoFactorConfigured(undefined)).toBe(false);
  });

  it("throws an error when key is configured but has invalid length", () => {
    expect(() => getTwoFactorEncryptionKey("too-short-key")).toThrow(
      /must be exactly 32 bytes/i,
    );
  });

  it("encrypts and decrypts a TOTP secret correctly (round trip)", () => {
    const plainSecret = "JBSWY3DPEHPK3PXP";
    const encrypted = encryptTwoFactorSecret(plainSecret, validHexKey);

    expect(encrypted).toMatch(/^v1:[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
    expect(encrypted).not.toContain(plainSecret);

    const decrypted = decryptTwoFactorSecret(encrypted, validHexKey);
    expect(decrypted).toBe(plainSecret);
  });

  it("detects tampering with ciphertext or auth tag", () => {
    const plainSecret = "JBSWY3DPEHPK3PXP";
    const encrypted = encryptTwoFactorSecret(plainSecret, validHexKey);
    const parts = encrypted.split(":");

    // Tamper with ciphertext
    const tamperedCiphertext =
      parts[0] +
      ":" +
      parts[1] +
      ":" +
      parts[2] +
      ":" +
      (parts[3].endsWith("a") ? parts[3].slice(0, -1) + "b" : parts[3].slice(0, -1) + "a");

    expect(() =>
      decryptTwoFactorSecret(tamperedCiphertext, validHexKey),
    ).toThrow();

    // Tamper with auth tag
    const tamperedTag =
      parts[0] +
      ":" +
      parts[1] +
      ":" +
      (parts[2].endsWith("a") ? parts[2].slice(0, -1) + "b" : parts[2].slice(0, -1) + "a") +
      ":" +
      parts[3];

    expect(() => decryptTwoFactorSecret(tamperedTag, validHexKey)).toThrow();
  });
});
