import { ExecutionContext, Logger, UnauthorizedException } from "@nestjs/common";
import * as crypto from "crypto";
import { MetaSignatureGuard } from "./meta-signature.guard";

describe("MetaSignatureGuard", () => {
  let guard: MetaSignatureGuard;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    guard = new MetaSignatureGuard();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function createMockContext(
    headers: Record<string, string>,
    rawBody: any,
    body: any,
  ): ExecutionContext {
    const request = {
      headers,
      rawBody,
      body,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  function signPayload(payload: string, secret: string): string {
    return (
      "sha256=" +
      crypto
        .createHmac("sha256", secret)
        .update(Buffer.from(payload, "utf8"))
        .digest("hex")
    );
  }

  it("fails closed with 401 and logs warning once when META_APP_SECRET is missing", () => {
    delete process.env.META_APP_SECRET;
    const loggerWarnSpy = jest
      .spyOn(Logger.prototype, "warn")
      .mockImplementation();

    const payload = '{"object":"page"}';
    const context1 = createMockContext(
      { "x-hub-signature-256": signPayload(payload, "any_secret") },
      Buffer.from(payload),
      JSON.parse(payload),
    );

    expect(() => guard.canActivate(context1)).toThrow(UnauthorizedException);

    const context2 = createMockContext(
      { "x-hub-signature-256": signPayload(payload, "any_secret") },
      Buffer.from(payload),
      JSON.parse(payload),
    );

    expect(() => guard.canActivate(context2)).toThrow(UnauthorizedException);

    expect(loggerWarnSpy).toHaveBeenCalledTimes(1);
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("META_APP_SECRET environment variable is not configured"),
    );

    loggerWarnSpy.mockRestore();
  });

  it("rejects request with 401 when x-hub-signature-256 header is missing", () => {
    process.env.META_APP_SECRET = "test_secret";
    const payload = '{"object":"page"}';
    const context = createMockContext(
      {},
      Buffer.from(payload),
      JSON.parse(payload),
    );

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("rejects request with 401 when header format is malformed (missing sha256= prefix)", () => {
    process.env.META_APP_SECRET = "test_secret";
    const payload = '{"object":"page"}';
    const rawSignature = crypto
      .createHmac("sha256", "test_secret")
      .update(payload)
      .digest("hex");
    const context = createMockContext(
      { "x-hub-signature-256": rawSignature },
      Buffer.from(payload),
      JSON.parse(payload),
    );

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("rejects request with 401 when header format is malformed (invalid hex string)", () => {
    process.env.META_APP_SECRET = "test_secret";
    const payload = '{"object":"page"}';
    const context = createMockContext(
      { "x-hub-signature-256": "sha256=not_a_valid_hex_string_xyz!!!" },
      Buffer.from(payload),
      JSON.parse(payload),
    );

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("rejects request with 401 when signature hex length mismatch", () => {
    process.env.META_APP_SECRET = "test_secret";
    const payload = '{"object":"page"}';
    const context = createMockContext(
      { "x-hub-signature-256": "sha256=abcd" },
      Buffer.from(payload),
      JSON.parse(payload),
    );

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("rejects request with 401 when signature is wrong", () => {
    process.env.META_APP_SECRET = "test_secret";
    const payload = '{"object":"page"}';
    const wrongSignature = signPayload(payload, "wrong_secret");
    const context = createMockContext(
      { "x-hub-signature-256": wrongSignature },
      Buffer.from(payload),
      JSON.parse(payload),
    );

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("rejects request with 401 when body is tampered after signing", () => {
    process.env.META_APP_SECRET = "test_secret";
    const originalPayload = '{"object":"page","entry":[{"id":"1"}]}';
    const tamperedPayload = '{"object":"page","entry":[{"id":"2"}]}';

    const signatureForOriginal = signPayload(originalPayload, "test_secret");

    const context = createMockContext(
      { "x-hub-signature-256": signatureForOriginal },
      Buffer.from(tamperedPayload),
      JSON.parse(tamperedPayload),
    );

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("accepts request when signature is valid against raw body", () => {
    process.env.META_APP_SECRET = "test_secret";
    const payload = '{"object":"page","entry":[{"id":"123"}]}';
    const validSignature = signPayload(payload, "test_secret");

    const context = createMockContext(
      { "x-hub-signature-256": validSignature },
      Buffer.from(payload),
      JSON.parse(payload),
    );

    expect(guard.canActivate(context)).toBe(true);
  });
});
