import { getPublicReadThrottleLimit, getAdminThrottleLimit } from "./throttling";

describe("getPublicReadThrottleLimit", () => {
  const originalEnv = process.env.PUBLIC_READ_THROTTLE_LIMIT;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.PUBLIC_READ_THROTTLE_LIMIT = originalEnv;
    } else {
      delete process.env.PUBLIC_READ_THROTTLE_LIMIT;
    }
  });

  it("returns default 120 when env variable is missing or empty", () => {
    delete process.env.PUBLIC_READ_THROTTLE_LIMIT;
    expect(getPublicReadThrottleLimit()).toBe(120);

    process.env.PUBLIC_READ_THROTTLE_LIMIT = "";
    expect(getPublicReadThrottleLimit()).toBe(120);

    process.env.PUBLIC_READ_THROTTLE_LIMIT = "   ";
    expect(getPublicReadThrottleLimit()).toBe(120);
  });

  it("parses valid positive integer limits", () => {
    process.env.PUBLIC_READ_THROTTLE_LIMIT = "120";
    expect(getPublicReadThrottleLimit()).toBe(120);

    process.env.PUBLIC_READ_THROTTLE_LIMIT = " 250 ";
    expect(getPublicReadThrottleLimit()).toBe(250);

    process.env.PUBLIC_READ_THROTTLE_LIMIT = "0";
    expect(getPublicReadThrottleLimit()).toBe(0);
  });

  it("returns default 120 for non-numeric, negative, or non-integer values", () => {
    process.env.PUBLIC_READ_THROTTLE_LIMIT = "invalid";
    expect(getPublicReadThrottleLimit()).toBe(120);

    process.env.PUBLIC_READ_THROTTLE_LIMIT = "-10";
    expect(getPublicReadThrottleLimit()).toBe(120);

    process.env.PUBLIC_READ_THROTTLE_LIMIT = "120.5";
    expect(getPublicReadThrottleLimit()).toBe(120);
  });
});

describe("getAdminThrottleLimit", () => {
  const originalEnv = process.env.ADMIN_THROTTLE_LIMIT;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ADMIN_THROTTLE_LIMIT = originalEnv;
    } else {
      delete process.env.ADMIN_THROTTLE_LIMIT;
    }
  });

  it("returns default 120 when env variable is missing or empty", () => {
    delete process.env.ADMIN_THROTTLE_LIMIT;
    expect(getAdminThrottleLimit()).toBe(120);

    process.env.ADMIN_THROTTLE_LIMIT = "";
    expect(getAdminThrottleLimit()).toBe(120);

    process.env.ADMIN_THROTTLE_LIMIT = "   ";
    expect(getAdminThrottleLimit()).toBe(120);
  });

  it("parses valid positive integer limits", () => {
    process.env.ADMIN_THROTTLE_LIMIT = "120";
    expect(getAdminThrottleLimit()).toBe(120);

    process.env.ADMIN_THROTTLE_LIMIT = " 250 ";
    expect(getAdminThrottleLimit()).toBe(250);

    process.env.ADMIN_THROTTLE_LIMIT = "0";
    expect(getAdminThrottleLimit()).toBe(0);
  });

  it("returns default 120 for non-numeric, negative, or non-integer values", () => {
    process.env.ADMIN_THROTTLE_LIMIT = "invalid";
    expect(getAdminThrottleLimit()).toBe(120);

    process.env.ADMIN_THROTTLE_LIMIT = "-10";
    expect(getAdminThrottleLimit()).toBe(120);

    process.env.ADMIN_THROTTLE_LIMIT = "120.5";
    expect(getAdminThrottleLimit()).toBe(120);
  });
});
