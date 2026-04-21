import { PaginatedResponse } from '../interfaces/paginated-response.interface';

export function toPagination(page = 1, limit = 20) {
  return {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit,
  };
}

export function toPaginatedResponse<T>(params: {
  items: T[];
  total: number;
  page: number;
  limit: number;
}): PaginatedResponse<T> {
  return {
    items: params.items,
    total: params.total,
    page: params.page,
    limit: params.limit,
    pageCount: Math.max(1, Math.ceil(params.total / params.limit)),
  };
}
