import {
  Field,
  InputType,
  Int,
  ObjectType,
  PartialType,
  PickType,
} from '@nestjs/graphql';
import { IsOptional, Max, Min } from 'class-validator';
import { PaginatedType } from 'src/common/objecttypes/pagination';
import { User } from '../schema/user.schema';

@InputType()
export class CreateUserInput extends PickType(User, [
  'firstName',
  'lastName',
  'email',
  'username',
  'phone',
  'password',
  'gender',
]) {}

@InputType()
export class GetUserInput extends PickType(User, ['_id']) {}

@InputType()
export class PaginateUserInput extends PartialType(
  PickType(User, ['gender', 'status']),
) {
  @IsOptional()
  @Field(() => String, { nullable: true })
  search?: string;

  @Min(1)
  @IsOptional()
  @Field(() => Int, { nullable: true })
  page?: number;

  @Max(100)
  @IsOptional()
  @Field(() => Int, { nullable: true })
  limit?: number;
}

@ObjectType()
export class PaginatedUser extends PaginatedType(User) {}
