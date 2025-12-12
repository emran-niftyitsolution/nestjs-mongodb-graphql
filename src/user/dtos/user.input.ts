import {
  Field,
  ID,
  InputType,
  ObjectType,
  OmitType,
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
import { PaginatedType } from '../../common/objecttypes/pagination';
import { User } from '../schema/user.schema';

@InputType()
export class GetUserInput extends PickType(User, ['_id']) {}

@InputType()
export class PaginateUserInput extends PartialType(
  PickType(User, ['gender', 'status']),
) {
  @IsOptional()
  search?: string;

  @Min(1)
  @IsOptional()
  page?: number;

  @Max(100)
  @IsOptional()
  limit?: number;
}

@InputType()
export class CreateUserInput extends OmitType(User, [
  '_id',
  'createdAt',
  'updatedAt',
  'createdBy',
  'lastActiveAt',
  'password',
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
  password: string;
}

@InputType()
export class UpdateUserInput extends PartialType(
  OmitType(User, [
    '_id',
    'email',
    'lastActiveAt',
    'createdAt',
    'updatedAt',
    'createdBy',
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
  @IsNotEmpty()
  @IsOptional()
  password?: string;
}

@InputType()
export class SoftDeleteUserInput extends PickType(User, ['_id']) {}

@ObjectType()
export class PaginatedUser extends PaginatedType(User) {}
