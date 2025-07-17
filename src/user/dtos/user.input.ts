import {
  Field,
  ID,
  InputType,
  Int,
  ObjectType,
  PartialType,
  PickType,
} from '@nestjs/graphql';
import {
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsStrongPassword,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Types } from 'mongoose';
import { PaginatedType } from 'src/common/objecttypes/pagination';
import { User } from '../schema/user.schema';

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
export class CreateUserInput extends PickType(User, [
  'firstName',
  'lastName',
  'email',
  'username',
  'phone',
  'gender',
]) {
  @MaxLength(32)
  @MinLength(8)
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  })
  @IsString()
  @IsNotEmpty()
  @Field(() => String)
  password: string;
}

@InputType()
export class UpdateUserInput extends PartialType(
  PickType(User, [
    'firstName',
    'lastName',
    'email',
    'username',
    'phone',
    'gender',
    'status',
  ]),
) {
  @IsMongoId()
  @IsNotEmpty()
  @Field(() => ID)
  _id: Types.ObjectId;

  @MaxLength(32)
  @MinLength(8)
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  })
  @IsString()
  @IsOptional()
  @Field(() => String, { nullable: true })
  password?: string;
}

@InputType()
export class SoftDeleteUserInput extends PickType(User, ['_id']) {}

@ObjectType()
export class PaginatedUser extends PaginatedType(User) {}
