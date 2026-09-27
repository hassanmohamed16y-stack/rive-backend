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
export function isLocalOnlyEnvironment(
  nodeEnv: string | undefined = process.env.NODE_ENV,
  environment: Record<string, string | undefined> = process.env,
): boolean {
  // If cloud provider variables (such as Railway or Render) are present,
  // the app is running in a deployed environment regardless of NODE_ENV.
  const isCloudDeployment = Boolean(
    environment.RAILWAY_ENVIRONMENT ||
      environment.RAILWAY_PROJECT_ID ||
      environment.RAILWAY_SERVICE_ID ||
      environment.RAILWAY_STATIC_URL ||
      environment.RENDER ||
      environment.HEROKU,
  );

  if (isCloudDeployment) {
    return false;
  }

  // Without NODE_ENV explicitly set to "development" or "test", default to non-local (strict validation).
  return nodeEnv === "development" || nodeEnv === "test";
}
