import { timingSafeEqual } from 'crypto';

export function timingSafeStringEqual(a?: string | null, b?: string | null): boolean {
  if (!a || !b) {
    return false;
  }

  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}
