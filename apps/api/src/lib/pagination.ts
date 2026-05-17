import type { PageData } from "@collab/shared";

export type PaginationInput = {
  page?: unknown;
  pageSize?: unknown;
};

export function parsePagination(query: PaginationInput) {
  const page = Math.max(Number(query.page ?? 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize ?? 20), 1), 100);

  return {
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 20
  };
}

export function paginate<T>(items: T[], page: number, pageSize: number): PageData<T> {
  const total = items.length;
  const start = (page - 1) * pageSize;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    total,
    totalPages
  };
}
