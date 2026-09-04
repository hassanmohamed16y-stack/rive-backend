/**
 * Shared pagination helpers used by every `findAll`-style list endpoint
 * (categories, products, orders, ...). Centralizing this avoids each service
 * reimplementing its own `page`/`limit` defaulting and `skip`/`take`/`totalPages`
 * arithmetic slightly differently.
 */

export interface PaginationInput {
  page?: number;
  limit?: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

/**
 * Resolves the effective page/limit (applying defaults) and derives the
 * `skip`/`take` values to pass to Prisma's `findMany`.
 */
export function resolvePagination(
  pagination?: PaginationInput,
  defaultLimit: number = DEFAULT_LIMIT,
): PaginationParams {
  const page = pagination?.page ?? DEFAULT_PAGE;
  const limit = pagination?.limit ?? defaultLimit;
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

/** Builds the `meta` block returned alongside paginated `data` arrays. */
export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}
