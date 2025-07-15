import {
  Field,
  ID,
  InputType,
  Int,
  ObjectType,
  PartialType,
  PickType,
} from '@nestjs/graphql';
import { IsMongoId, IsNotEmpty, IsOptional, Max, Min } from 'class-validator';
import { Types } from 'mongoose';
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

@InputType()
export class UpdateUserInput extends PartialType(
  PickType(User, [
    'firstName',
    'lastName',
    'email',
    'username',
    'phone',
    'password',
    'gender',
    'status',
  ]),
) {
  @IsMongoId()
  @IsNotEmpty()
  @Field(() => ID)
  _id: Types.ObjectId;
}

@InputType()
export class SoftDeleteUserInput extends PickType(User, ['_id']) {}

@ObjectType()
export class PaginatedUser extends PaginatedType(User) {}
