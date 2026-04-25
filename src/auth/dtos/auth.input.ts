import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import {
  IsEmail,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsStrongPassword,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { User } from '../../user/schema/user.schema';

@InputType()
export class LoginInput {
  @IsEmail()
  @IsString()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @Field(() => String, { nullable: true, description: 'E.g. “Chrome on Mac”' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  deviceName?: string;
}

@InputType()
export class SignupInput {
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsEmail()
  @IsString()
  @IsNotEmpty()
  email!: string;

  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  })
  @MaxLength(32)
  @MinLength(8)
  @IsString()
  @IsNotEmpty()
  password!: string;

  @Field(() => String, { nullable: true, description: 'E.g. “iPhone 15”' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  deviceName?: string;
}

@ObjectType()
export class LoginResponse {
  accessToken!: string;
  refreshToken!: string;
  user!: User;
}

@InputType()
export class RefreshTokenInput {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

@ObjectType()
export class LogoutResult {
  @Field()
  success!: boolean;
}

@InputType()
export class LogoutAllInput {
  @Field(() => ID, {
    nullable: true,
    description:
      'Super admin only: end all sessions for this user. Omit to sign out all of your own devices.',
  })
  @IsOptional()
  @IsMongoId()
  forUserId?: string;
}

@ObjectType()
export class UserSessionListEntry {
  @Field(() => ID)
  _id!: string;

  @Field(() => String, { nullable: true })
  userAgent?: string;

  @Field(() => String, { nullable: true })
  ipAddress?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Name from login/signup',
  })
  deviceName?: string;

  @Field(() => Date, { nullable: true })
  lastActiveAt?: Date;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;

  @Field({
    description:
      'True when this row is the session tied to the access token used for this request',
  })
  isCurrent!: boolean;
}

@InputType()
export class RevokeSessionInput {
  @Field(() => ID)
  @IsMongoId()
  @IsNotEmpty()
  sessionId!: string;
}
