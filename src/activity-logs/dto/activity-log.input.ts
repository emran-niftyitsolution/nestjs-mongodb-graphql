import {
  Field,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { IsOptional, IsString, Min } from 'class-validator';
import { PaginatedType } from '../../common/objecttypes/pagination';
import { ActivityLog } from '../schemas/activity-logs.schema';

export enum LogActionType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

registerEnumType(LogActionType, { name: 'LogActionType' });

@InputType()
export class ActivityLogPaginateFilterInput {
  @Field({ description: 'Filter by target (collection) name', nullable: true })
  @IsOptional()
  @IsString()
  target?: string;

  @Field(() => LogActionType, {
    description: 'Filter by action',
    nullable: true,
  })
  @IsOptional()
  action?: LogActionType;

  @Field({
    description: 'Search by documentId or user (id, name, email)',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @Field({ description: 'Start date (inclusive)', nullable: true })
  @IsOptional()
  startDate?: Date;

  @Field({ description: 'End date (inclusive)', nullable: true })
  @IsOptional()
  endDate?: Date;

  @Field(() => Int, {
    description: 'Sort by createdAt (1 asc, -1 desc)',
    nullable: true,
  })
  @IsOptional()
  sortByCreatedAt?: 1 | -1;

  @Min(1)
  @IsOptional()
  @Field(() => Int, { nullable: true })
  page?: number;

  @IsOptional()
  @Field(() => Int, { nullable: true })
  limit?: number;
}

@ObjectType()
export class PaginatedActivityLog extends PaginatedType(ActivityLog) {}
