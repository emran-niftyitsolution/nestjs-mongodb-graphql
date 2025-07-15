import { InputType, PickType } from '@nestjs/graphql';
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
