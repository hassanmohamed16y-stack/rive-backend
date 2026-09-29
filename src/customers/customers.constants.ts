export const CUSTOMER_TIER_THRESHOLDS = {
  VIP: 10000,
  REGULAR: 2000,
  NEW: 0,
} as const;

export type CustomerTier = "NEW" | "REGULAR" | "VIP";

export function calculateCustomerTier(totalSpent: number): CustomerTier {
  if (totalSpent >= CUSTOMER_TIER_THRESHOLDS.VIP) {
    return "VIP";
  }
  if (totalSpent >= CUSTOMER_TIER_THRESHOLDS.REGULAR) {
    return "REGULAR";
  }
  return "NEW";
}
