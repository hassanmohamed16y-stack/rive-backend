import type { ExecutionContext } from "@nestjs/common";
import { ROLES_KEY } from "../../auth/roles.decorator";

export function getPublicReadThrottleLimit(): number {
  const envVal = process.env.PUBLIC_READ_THROTTLE_LIMIT;
  if (!envVal || envVal.trim() === "") {
    return 120;
  }
  const trimmed = envVal.trim();
  if (!/^\d+$/.test(trimmed)) {
    return 120;
  }
  const parsed = parseInt(trimmed, 10);
  if (isNaN(parsed) || parsed < 0) {
    return 120;
  }
  return parsed;
}

export function getAdminThrottleLimit(): number {
  const envVal = process.env.ADMIN_THROTTLE_LIMIT;
  if (!envVal || envVal.trim() === "") {
    return 120;
  }
  const trimmed = envVal.trim();
  if (!/^\d+$/.test(trimmed)) {
    return 120;
  }
  const parsed = parseInt(trimmed, 10);
  if (isNaN(parsed) || parsed < 0) {
    return 120;
  }
  return parsed;
}

/** Default limit for routes that have no explicit @Throttle (public / customer). */
export const DEFAULT_THROTTLE_LIMIT = 10;

/**
 * Limit used by the global throttler when a route has no @Throttle of its own.
 * Routes that require the ADMIN role get the admin limit, so ordinary use of
 * the dashboard is not blocked; everything else keeps the strict default.
 */
export function resolveDefaultThrottleLimit(context: ExecutionContext): number {
  const roles =
    (Reflect.getMetadata(ROLES_KEY, context.getHandler()) as
      string[] | undefined) ??
    (Reflect.getMetadata(ROLES_KEY, context.getClass()) as
      string[] | undefined);
  return roles?.includes("ADMIN")
    ? getAdminThrottleLimit()
    : DEFAULT_THROTTLE_LIMIT;
}
