import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { PaginateModel } from 'mongoose';
import { CreateUserInput } from './dtos/user.input';
import { User, UserDocument } from './schema/user.schema';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: PaginateModel<UserDocument>,
  ) {}

  async create(input: CreateUserInput): Promise<User> {
    return this.userModel.create(input);
  }
}
