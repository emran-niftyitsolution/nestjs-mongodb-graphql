import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { PaginateModel } from 'mongoose';
import {
  CreateUserInput,
  PaginatedUser,
  PaginateUserInput,
} from './dtos/user.input';
import { User, UserDocument } from './schema/user.schema';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: PaginateModel<UserDocument>,
  ) {}

  queryBuilder(user: Partial<User>) {
    const query = {
      ...(user.firstName && {
        firstName: { $regex: user.firstName, $options: 'i' },
      }),
      ...(user.lastName && {
        lastName: { $regex: user.lastName, $options: 'i' },
      }),
      ...(user.email && { email: { $regex: user.email, $options: 'i' } }),
      ...(user.username && {
        username: { $regex: user.username, $options: 'i' },
      }),
      ...(user.phone && { phone: { $regex: user.phone, $options: 'i' } }),
      ...(user.gender && { gender: user.gender }),
      ...(user.status && { status: user.status }),
    };

    return query;
  }

  async create(input: CreateUserInput): Promise<User> {
    return this.userModel.create(input);
  }

  getUser(input: Partial<User>): Promise<User | null> {
    const query = this.queryBuilder(input);
    return this.userModel.findOne(query);
  }

  getUsers(input: PaginateUserInput): Promise<PaginatedUser> {
    const { page, limit, search, ...rest } = input;

    const query = {
      ...(search && {
        $or: [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { username: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
        ],
      }),
      ...this.queryBuilder(rest),
    };

    return this.userModel.paginate(query, {
      page: page || 1,
      limit: limit || 10,
    });
  }
}
