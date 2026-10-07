import { maskPhoneLast3, normalizeEgyptianPhone } from "./phone-normalization";

describe("phone-normalization utility", () => {
  describe("normalizeEgyptianPhone", () => {
    it("normalizes phone with +20 prefix", () => {
      expect(normalizeEgyptianPhone("+201000000000")).toBe("+201000000000");
    });

    it("normalizes phone with 0020 prefix", () => {
      expect(normalizeEgyptianPhone("00201000000000")).toBe("+201000000000");
    });

    it("normalizes phone with 20 prefix", () => {
      expect(normalizeEgyptianPhone("201000000000")).toBe("+201000000000");
    });

    it("normalizes phone with leading 0", () => {
      expect(normalizeEgyptianPhone("01000000000")).toBe("+201000000000");
    });

    it("normalizes 10-digit phone starting with 1", () => {
      expect(normalizeEgyptianPhone("1000000000")).toBe("+201000000000");
    });

    it("normalizes phone with spaces and hyphens", () => {
      expect(normalizeEgyptianPhone("+20 100-000-0000")).toBe("+201000000000");
      expect(normalizeEgyptianPhone("011 1234 5678")).toBe("+201112345678");
      expect(normalizeEgyptianPhone("012-9876-5432")).toBe("+201298765432");
      expect(normalizeEgyptianPhone("015 5555 5555")).toBe("+201555555555");
    });

    it("returns null for null, undefined, or empty input", () => {
      expect(normalizeEgyptianPhone(null)).toBeNull();
      expect(normalizeEgyptianPhone(undefined)).toBeNull();
      expect(normalizeEgyptianPhone("")).toBeNull();
      expect(normalizeEgyptianPhone("   ")).toBeNull();
    });

    it("returns null for invalid Egyptian phone numbers", () => {
      expect(normalizeEgyptianPhone("01300000000")).toBeNull(); // 013 is invalid operator
      expect(normalizeEgyptianPhone("123456")).toBeNull();
      expect(normalizeEgyptianPhone("abcdefghijk")).toBeNull();
      expect(normalizeEgyptianPhone("+12345678900")).toBeNull();
    });
  });

  describe("maskPhoneLast3", () => {
    it("masks phone keeping only the last 3 digits", () => {
      expect(maskPhoneLast3("+201000000123")).toBe("***123");
      expect(maskPhoneLast3("01112345678")).toBe("***678");
    });

    it("handles short digit strings gracefully", () => {
      expect(maskPhoneLast3("12")).toBe("***12");
    });

    it("handles null/non-string safely", () => {
      expect(maskPhoneLast3(null as any)).toBe("***");
    });
  });
});
