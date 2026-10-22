import { BadRequestException } from "@nestjs/common";
import { UploadService } from "./upload.service";
import { detectImageMime } from "./image-signature";

const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000100af5b9c4a0000000049454e44ae426082",
  "hex",
);
const JPEG = Buffer.concat([Buffer.from("ffd8ffe000104a464946", "hex"), Buffer.alloc(20)]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0x24, 0, 0, 0]), Buffer.from("WEBPVP8 "), Buffer.alloc(20)]);

describe("detectImageMime", () => {
  it("detects png / jpeg / webp from leading bytes", () => {
    expect(detectImageMime(PNG)).toBe("image/png");
    expect(detectImageMime(JPEG)).toBe("image/jpeg");
    expect(detectImageMime(WEBP)).toBe("image/webp");
  });

  it("rejects other content (exe, gif, wav riff, too short)", () => {
    expect(detectImageMime(Buffer.from("MZ header executable code..."))).toBeUndefined();
    expect(detectImageMime(Buffer.from("GIF89a" + "x".repeat(20)))).toBeUndefined();
    expect(detectImageMime(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WAVEfmt "), Buffer.alloc(8)]))).toBeUndefined();
    expect(detectImageMime(Buffer.alloc(4))).toBeUndefined();
    expect(detectImageMime(undefined)).toBeUndefined();
  });
});

describe("UploadService.validateMimeType", () => {
  const service = new UploadService();
  const check = (buffer: Buffer, mimetype: string) =>
    (service as any).validateMimeType({ buffer, mimetype, size: buffer.length });

  it("accepts genuine PNG, JPEG and WEBP", async () => {
    await expect(check(PNG, "image/png")).resolves.toBeUndefined();
    await expect(check(JPEG, "image/jpeg")).resolves.toBeUndefined();
    await expect(check(WEBP, "image/webp")).resolves.toBeUndefined();
  });

  it("rejects disallowed declared mimetypes", async () => {
    await expect(check(PNG, "image/gif")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a file whose bytes are not a supported image", async () => {
    await expect(check(Buffer.from("MZ header executable code..."), "image/png")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects files over 5MB", async () => {
    await expect(
      (service as any).validateMimeType({ buffer: JPEG, mimetype: "image/jpeg", size: 6 * 1024 * 1024 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
