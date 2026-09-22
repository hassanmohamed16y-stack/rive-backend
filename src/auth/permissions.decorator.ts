import { SetMetadata } from "@nestjs/common";

export const PERMISSIONS_KEY = "permissions";

/**
 * Decorator to enforce permission requirements on controller methods or classes.
 * Usage: `@RequirePermission('orders.refund')` or `@RequirePermission('orders.view', 'orders.refund')`
 */
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

// Alias for flexibility
export const Permissions = RequirePermission;
