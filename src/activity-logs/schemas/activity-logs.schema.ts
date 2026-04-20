import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';

@ObjectType()
export class ActivityLog {
  @Field(() => Int)
  id!: number;

  @Field({ description: 'The collection name' })
  collectionName!: string;

  @Field({ description: 'The action performed' })
  action!: string;

  @Field(() => Int, {
    nullable: true,
    description: 'The user who performed the action',
  })
  user?: number | null;

  @Field(() => ID, {
    nullable: true,
    description: 'The original document id',
  })
  documentId?: string | null;

  @Field(() => GraphQLJSON, { description: 'The payload of the request' })
  payload!: Record<string, unknown>;

  @Field(() => GraphQLJSON, {
    description: 'The difference of the previous and updated document',
  })
  changes!: Record<string, unknown>;

  @Field({ nullable: true })
  createdAt?: Date;

  @Field({ nullable: true })
  updatedAt?: Date;
}
