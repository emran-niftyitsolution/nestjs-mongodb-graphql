import {
  Field,
  HideField,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
}

registerEnumType(Gender, {
  name: 'Gender',
});

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  BANNED = 'BANNED',
  DELETED = 'DELETED',
  PENDING = 'PENDING',
}

registerEnumType(UserStatus, {
  name: 'UserStatus',
});

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  USER = 'USER',
}

registerEnumType(UserRole, {
  name: 'UserRole',
});

@InputType('UserInput')
@ObjectType()
export class User {
  @IsInt()
  @IsNotEmpty()
  @Field(() => Int)
  id!: number;

  @MaxLength(20)
  @MinLength(2)
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @MaxLength(20)
  @MinLength(2)
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsEmail()
  @IsString()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsOptional()
  username?: string;

  @IsPhoneNumber()
  @IsString()
  @IsOptional()
  phone?: string;

  @HideField()
  password!: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  gender?: Gender;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  role?: UserRole;

  @IsOptional()
  @Field(() => ID)
  createdBy?: string;

  @IsOptional()
  lastActiveAt?: Date;

  @IsOptional()
  status?: UserStatus;

  createdAt?: Date;
  updatedAt?: Date;
}
