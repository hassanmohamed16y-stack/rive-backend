/**
 * Usernames are matched case-insensitively and with single spaces,
 * so "Hassan  Mohamed" and "hassan mohamed" are the same sign-in name.
 */
export function normalizeUsername(value?: string | null): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}
