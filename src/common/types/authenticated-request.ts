import { Request } from 'express';

/**
 * Shape attached to `req.user` by JwtAuthGuard / OptionalJwtAuthGuard after
 * `JwtStrategy.validate()` runs (see src/auth/jwt.strategy.ts). `id` and
 * `userId` are intentionally both populated with the same value: some
 * call-sites historically read `req.user.id` (admin-only routes) while
 * others read `req.user.userId` (routes also reachable by guests via
 * OptionalJwtAuthGuard, where `user` may be `undefined`).
 */
export interface AuthenticatedUser {
  id: string;
  userId: string;
  email: string;
  role: string;
}

/** Express `Request` augmented with the optional authenticated user. */
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}
