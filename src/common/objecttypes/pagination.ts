// src/common/paginated-type.ts
import { Field, Int, ObjectType } from '@nestjs/graphql';

type Constructor<T> = new (...args: any[]) => T;

/**
 * Factory to create a paginated result GraphQL type
 */
export function PaginatedType<T>(TClass: Constructor<T>) {
  @ObjectType({ isAbstract: true })
  abstract class PaginatedTypeClass {
    @Field(() => [TClass])
    docs: T[];

    @Field(() => Int)
    totalDocs: number;

    @Field(() => Int)
    limit: number;

    @Field(() => Boolean)
    hasPrevPage: boolean;

    @Field(() => Boolean)
    hasNextPage: boolean;

    @Field(() => Int, { nullable: true })
    page?: number;

    @Field(() => Int)
    totalPages: number;

    @Field(() => Int, { nullable: true })
    offset?: number;

    @Field(() => Int, { nullable: true })
    prevPage?: number | null;

    @Field(() => Int, { nullable: true })
    nextPage?: number | null;

    @Field(() => Int)
    pagingCounter: number;
  }
  return PaginatedTypeClass;
}
