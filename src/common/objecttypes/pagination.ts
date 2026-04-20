// src/common/paginated-type.ts
import { Field, Int, ObjectType } from '@nestjs/graphql';

type Constructor<T> = new (...args: any[]) => T;

export interface PaginatedResult<T> {
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
}

export function buildPaginatedResult<T>(input: {
  docs: T[];
  totalDocs: number;
  page: number;
  limit: number;
  offset: number;
}): PaginatedResult<T> {
  const totalPages = Math.max(1, Math.ceil(input.totalDocs / input.limit));

  return {
    docs: input.docs,
    totalDocs: input.totalDocs,
    limit: input.limit,
    hasPrevPage: input.page > 1,
    hasNextPage: input.page < totalPages,
    page: input.page,
    totalPages,
    offset: input.offset,
    prevPage: input.page > 1 ? input.page - 1 : null,
    nextPage: input.page < totalPages ? input.page + 1 : null,
    pagingCounter: input.totalDocs === 0 ? 0 : input.offset + 1,
  };
}

/**
 * Factory to create a paginated result GraphQL type
 */
export function PaginatedType<T>(TClass: Constructor<T>) {
  @ObjectType({ isAbstract: true })
  abstract class PaginatedTypeClass {
    @Field(() => [TClass])
    docs!: T[];

    @Field(() => Int)
    totalDocs!: number;

    @Field(() => Int)
    limit!: number;

    @Field(() => Boolean)
    hasPrevPage!: boolean;

    @Field(() => Boolean)
    hasNextPage!: boolean;

    @Field(() => Int, { nullable: true })
    page?: number;

    @Field(() => Int)
    totalPages!: number;

    @Field(() => Int, { nullable: true })
    offset?: number;

    @Field(() => Int, { nullable: true })
    prevPage?: number | null;

    @Field(() => Int, { nullable: true })
    nextPage?: number | null;

    @Field(() => Int)
    pagingCounter!: number;
  }
  return PaginatedTypeClass;
}
