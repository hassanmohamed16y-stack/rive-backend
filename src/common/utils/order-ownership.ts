import { timingSafeStringEqual } from './timing-safe-compare';

/**
 * Determines whether an actor (authenticated user or guest) owns an order,
 * without any ADMIN bypass - callers are responsible for allowing ADMIN
 * access before invoking this check.
 *
 * An order is owned either by the authenticated user that placed it, or -
 * for guest orders (`userId === null`) - by whoever presents the matching
 * guest access token, compared using a timing-safe comparison.
 */
export function isOrderOwnedByActor(
  order: { userId: string | null; guestAccessToken?: string | null },
  actor?: { userId?: string; guestAccessToken?: string },
): boolean {
  const isUserOwner = order.userId !== null && order.userId === actor?.userId;
  const isGuestOwner = order.userId === null
    && timingSafeStringEqual(order.guestAccessToken, actor?.guestAccessToken);

  return isUserOwner || isGuestOwner;
}
