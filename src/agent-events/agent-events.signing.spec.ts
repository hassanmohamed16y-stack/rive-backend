import { createHmac } from "crypto";
import {
  AGENT_SIGNATURE_MAX_SKEW_SECONDS,
  signAgentEvent,
  verifyAgentEventSignature,
} from "./agent-events.signing";

describe("agent event signing", () => {
  const secret = "test_secret_with_at_least_32_characters!!";
  const body = '{"event_id":"evt_1","type":"order.created"}';
  const ts = 1_760_000_000;

  it("matches the contract formula v1=hex(HMAC_SHA256(secret, ts.body))", () => {
    const expected =
      "v1=" + createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
    expect(signAgentEvent(secret, ts, body)).toBe(expected);
  });

  it("verifies a fresh signature", () => {
    const sig = signAgentEvent(secret, ts, body);
    expect(verifyAgentEventSignature(secret, ts, body, sig, ts + 10)).toBe(true);
  });

  it("rejects a changed body, a wrong secret and a missing header", () => {
    const sig = signAgentEvent(secret, ts, body);
    expect(verifyAgentEventSignature(secret, ts, body + " ", sig, ts)).toBe(false);
    expect(verifyAgentEventSignature("other", ts, body, sig, ts)).toBe(false);
    expect(verifyAgentEventSignature(secret, ts, body, undefined, ts)).toBe(false);
  });

  it("rejects timestamps outside the 300 s window", () => {
    const sig = signAgentEvent(secret, ts, body);
    const late = ts + AGENT_SIGNATURE_MAX_SKEW_SECONDS + 1;
    expect(verifyAgentEventSignature(secret, ts, body, sig, late)).toBe(false);
    expect(
      verifyAgentEventSignature(secret, ts, body, sig, ts + AGENT_SIGNATURE_MAX_SKEW_SECONDS),
    ).toBe(true);
  });
});
