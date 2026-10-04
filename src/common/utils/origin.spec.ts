import { getFirstOrigin, parseOrigins } from "./origin";

describe("parseOrigins & getFirstOrigin", () => {
  describe("parseOrigins", () => {
    it("returns empty array for undefined, null, or empty string", () => {
      expect(parseOrigins(undefined)).toEqual([]);
      expect(parseOrigins("")).toEqual([]);
      expect(parseOrigins("   ")).toEqual([]);
    });

    it("parses single domain and strips trailing slashes", () => {
      expect(parseOrigins("https://store.example.com")).toEqual([
        "https://store.example.com",
      ]);
      expect(parseOrigins("https://store.example.com/")).toEqual([
        "https://store.example.com",
      ]);
      expect(parseOrigins("https://store.example.com///")).toEqual([
        "https://store.example.com",
      ]);
    });

    it("parses comma-separated origins with trimming, empty ignoring, and trailing slash removal", () => {
      const input =
        " https://store1.example.com/ , https://store2.example.com/// , , http://localhost:3000/ ";
      expect(parseOrigins(input)).toEqual([
        "https://store1.example.com",
        "https://store2.example.com",
        "http://localhost:3000",
      ]);
    });

    it("strips wildcard domains completely", () => {
      const input = "https://*.example.com, https://store.example.com, *";
      expect(parseOrigins(input)).toEqual(["https://store.example.com"]);
    });
  });

  describe("getFirstOrigin", () => {
    it("returns first valid origin from comma-separated string", () => {
      const input =
        " https://store1.example.com/ , https://store2.example.com ";
      expect(getFirstOrigin(input)).toBe("https://store1.example.com");
    });

    it("uses default fallback when input is empty or contains no valid origins", () => {
      expect(getFirstOrigin(undefined)).toBe("http://localhost:3001");
      expect(getFirstOrigin("")).toBe("http://localhost:3001");
      expect(getFirstOrigin(" * ")).toBe("http://localhost:3001");
    });

    it("uses custom fallback if provided", () => {
      expect(getFirstOrigin(undefined, "https://default.example.com")).toBe(
        "https://default.example.com",
      );
    });
  });
});
