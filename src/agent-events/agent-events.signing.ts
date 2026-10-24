import { createHmac } from "crypto";
import { timingSafeStringEqual } from "../common/utils/timing-safe-compare";

/** Max clock skew the receiver accepts (seconds). Mirrors EVENTS_CONTRACT.md §2. */
export const AGENT_SIGNATURE_MAX_SKEW_SECONDS = 300;

/**
 * Signs an outgoing agent event exactly as described in EVENTS_CONTRACT.md §2:
 *   signature = hex(HMAC_SHA256(secret, timestamp + "." + rawBody))
 *   header    = "v1=" + signature
 */
export function signAgentEvent(
  secret: string,
  timestampSeconds: number,
  rawBody: string,
): string {
  const digest = createHmac("sha256", secret)
    .update(`${timestampSeconds}.${rawBody}`, "utf8")
    .digest("hex");
  return `v1=${digest}`;
}

/** Verifies a signature header. Used by tests and by anything that receives agent callbacks. */
export function verifyAgentEventSignature(
  secret: string,
  timestampSeconds: number,
  rawBody: string,
  signatureHeader: string | undefined,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!secret || !signatureHeader || !Number.isFinite(timestampSeconds)) {
    return false;
  }
  if (Math.abs(nowSeconds - timestampSeconds) > AGENT_SIGNATURE_MAX_SKEW_SECONDS) {
    return false;
  }
  return timingSafeStringEqual(
    signatureHeader,
    signAgentEvent(secret, timestampSeconds, rawBody),
  );
}
