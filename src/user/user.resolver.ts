import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  CreateUserInput,
  GetUserInput,
  PaginatedUser,
  PaginateUserInput,
} from './dtos/user.input';
import { User } from './schema/user.schema';
import { UserService } from './user.service';

@Resolver(() => User)
export class UserResolver {
  constructor(private readonly userService: UserService) {}

  @Mutation(() => User)
  createUser(@Args('input') input: CreateUserInput): Promise<User> {
    return this.userService.create(input);
  }

  @Query(() => User)
  getUser(@Args('input') input: GetUserInput): Promise<User | null> {
    return this.userService.getUser(input);
  }

  @Query(() => PaginatedUser)
  getUsers(@Args('input') input: PaginateUserInput): Promise<PaginatedUser> {
    return this.userService.getUsers(input);
  }
}
