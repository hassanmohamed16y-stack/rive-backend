/**
 * Single source of truth for "are we running in a local-only environment"
 * (i.e. a developer's machine or the automated test runner).
 *
 * Any environment that is NOT development/test (production, staging, qa, or
 * anything else) is treated as a real deployment and must supply all
 * security-sensitive secrets (JWT_SECRET, etc.) and must never leak tokens
 * (email verification / password reset) in HTTP responses.
 *
 * This must be the only place that defines this distinction — do not
 * re-implement `NODE_ENV === 'production'` checks elsewhere for the same
 * purpose (see auth.module.ts, jwt.strategy.ts, auth.service.ts).
 */
export function isLocalOnlyEnvironment(nodeEnv: string | undefined = process.env.NODE_ENV): boolean {
  return nodeEnv === 'development' || nodeEnv === 'test';
}
