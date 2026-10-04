export function parseOrigins(input?: string): string[] {
  if (!input || !input.trim()) {
    return [];
  }
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !s.includes("*"))
    .map((s) => s.replace(/\/+$/, ""));
}

export function getFirstOrigin(
  input?: string,
  fallback = "http://localhost:3001",
): string {
  const origins = parseOrigins(input);
  return origins.length > 0 ? origins[0] : fallback;
}
