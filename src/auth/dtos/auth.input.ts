import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import { User } from '../../user/schema/user.schema';

@InputType()
export class LoginInput {
  @IsNotEmpty()
  @IsString()
  @Field(() => String)
  username: string;

  @IsNotEmpty()
  @IsString()
  @Field(() => String)
  password: string;
}

@ObjectType()
export class LoginResponse {
  @Field(() => String)
  accessToken: string;

  @Field(() => String)
  refreshToken: string;

  @Field(() => User, { nullable: true })
  user?: User;
}
