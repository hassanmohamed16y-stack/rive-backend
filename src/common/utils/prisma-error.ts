/**
 * Type guard for checking a Prisma error's code without importing Prisma's
 * runtime error classes, since errors caught from `$transaction`/query calls
 * are not always guaranteed to be `instanceof PrismaClientKnownRequestError`.
 */
export function isPrismaErrorCode(error: unknown, code: string): boolean {
  return (error as { code?: string } | null)?.code === code;
}
