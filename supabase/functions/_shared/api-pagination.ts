export interface PaginationParams {
  limit: number;
  offset: number;
}

export function parsePaginationParams(
  limitParam: string | undefined,
  offsetParam: string | undefined,
  defaultLimit = 50,
  maxLimit = 100
): PaginationParams {
  let limit = defaultLimit;
  let offset = 0;

  if (limitParam) {
    const parsed = parseInt(limitParam, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= maxLimit) {
      limit = parsed;
    }
  }

  if (offsetParam) {
    const parsed = parseInt(offsetParam, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      offset = parsed;
    }
  }

  return { limit, offset };
}

export function buildPaginationMeta(
  total: number | null,
  limit: number,
  offset: number
) {
  return {
    total: total || 0,
    limit,
    offset,
    page: Math.floor(offset / limit) + 1,
    pages: total ? Math.ceil(total / limit) : 1,
  };
}
