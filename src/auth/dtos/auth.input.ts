import { InputType, ObjectType } from '@nestjs/graphql';
import { IsNotBlank } from '../../common/validators/is-not-blank.validator';
import { User } from '../../user/schema/user.schema';

@InputType()
export class LoginInput {
  @IsNotBlank()
  username: string;

  @IsNotBlank()
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
  @IsNotBlank()
  refreshToken: string;
}
