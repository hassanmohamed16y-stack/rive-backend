import { isLocalOnlyEnvironment } from '../common/utils/environment';

/**
 * Fallback secret used only when running in a local development/test
 * environment and JWT_SECRET is not set. Never used outside
 * `isLocalOnlyEnvironment()` (see `resolveJwtSecret` below), which fails
 * fast instead in any other environment.
 */
export const DEV_ONLY_JWT_SECRET = 'development-only-secret';

/**
 * Single algorithm used to sign and verify access tokens. Pinning this
 * explicitly (both when signing in `JwtModule.register` and when verifying
 * in `JwtStrategy`) avoids relying on library defaults for algorithm
 * negotiation.
 */
export const JWT_ALGORITHM = 'HS256' as const;

/**
 * Resolves the JWT signing/verification secret. Fails fast (throws) if
 * JWT_SECRET is missing outside local development/test environments, so the
 * app never boots with (and never even constructs the JWT module/Passport
 * strategy with) the insecure development fallback secret in a real
 * deployment. This is the single source of truth for that fallback.
 */
export function resolveJwtSecret(): string {
  const configuredSecret = process.env.JWT_SECRET;
  if (configuredSecret) {
    return configuredSecret;
  }

  if (!isLocalOnlyEnvironment()) {
    throw new Error('JWT_SECRET is required outside local development/test environments');
  }

  return DEV_ONLY_JWT_SECRET;
}
