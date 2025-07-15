import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { PaginateModel, Types } from 'mongoose';
import {
  CreateUserInput,
  PaginatedUser,
  PaginateUserInput,
  UpdateUserInput,
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

  async updateUser(
    id: Types.ObjectId,
    update: Omit<UpdateUserInput, '_id'>,
  ): Promise<User | null> {
    return this.userModel.findByIdAndUpdate(id, update, { new: true });
  }

  async softDeleteUser(id: Types.ObjectId): Promise<User | null> {
    return this.userModel.findByIdAndUpdate(
      id,
      { status: 'DELETED' },
      { new: true },
    );
  }
}
