import { NotFoundException } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  CreateUserInput,
  GetUserInput,
  PaginatedUser,
  PaginateUserInput,
  SoftDeleteUserInput,
  UpdateUserInput,
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

  @Query(() => User, { nullable: true })
  async getUser(@Args('input') input: GetUserInput): Promise<User | null> {
    const user = await this.userService.getUser(input);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  @Query(() => PaginatedUser)
  getUsers(@Args('input') input: PaginateUserInput): Promise<PaginatedUser> {
    return this.userService.getUsers(input);
  }

  @Mutation(() => User)
  updateUser(@Args('input') input: UpdateUserInput): Promise<User | null> {
    const { _id, ...update } = input;
    return this.userService.updateUser(_id, update);
  }

  @Mutation(() => User)
  softDeleteUser(
    @Args('input') input: SoftDeleteUserInput,
  ): Promise<User | null> {
    return this.userService.softDeleteUser(input._id);
  }
}
