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
