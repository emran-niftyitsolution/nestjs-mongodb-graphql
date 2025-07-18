import { InputType, ObjectType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import { User } from '../../user/schema/user.schema';

@InputType()
export class LoginInput {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

@ObjectType()
export class LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

@InputType()
export class RefreshTokenInput {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
