export interface PaginateResult<T> {
  docs: T[];
  totalDocs: number;
  limit: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  page?: number;
  totalPages: number;
  offset?: number;
  prevPage?: number | null;
  nextPage?: number | null;
  pagingCounter: number;
  meta?: any;
}
