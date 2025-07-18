import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as argon2 from 'argon2';
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
      ...(user._id && { _id: user._id }),
      ...(user.firstName && { firstName: user.firstName }),
      ...(user.lastName && { lastName: user.lastName }),
      ...(user.email && { email: user.email }),
      ...(user.username && { username: user.username }),
      ...(user.phone && { phone: user.phone }),
      ...(user.gender && { gender: user.gender }),
      ...(user.status && { status: user.status }),
      ...(user.role && { role: user.role }),
    };

    return query;
  }

  async create(input: CreateUserInput): Promise<User> {
    const hashedPassword = await argon2.hash(input.password); // Ideally, you should hash the password here

    return this.userModel.create({
      ...input,
      password: hashedPassword,
    });
  }

  async getUser(input: Partial<User>): Promise<User | null> {
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
    input: Omit<UpdateUserInput, '_id'>,
  ): Promise<User | null> {
    if (input.password) {
      input.password = await argon2.hash(input.password); // Hash the password before updating
    }

    return this.userModel.findByIdAndUpdate(id, input, { new: true });
  }

  async softDeleteUser(id: Types.ObjectId): Promise<User | null> {
    return this.userModel.findByIdAndUpdate(
      id,
      { status: 'DELETED' },
      { new: true },
    );
  }
}
