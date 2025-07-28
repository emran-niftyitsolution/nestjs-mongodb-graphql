import { faker } from '@faker-js/faker';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import {
  CreateUserInput,
  GetUserInput,
  PaginateUserInput,
  SoftDeleteUserInput,
  UpdateUserInput,
} from './dtos/user.input';
import { Gender, UserRole, UserStatus } from './schema/user.schema';
import { UserResolver } from './user.resolver';
import { UserService } from './user.service';

describe('UserResolver', () => {
  let resolver: UserResolver;
  let userService: jest.Mocked<UserService>;

  const createMockUser = () => ({
    _id: new Types.ObjectId(),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    email: faker.internet.email(),
    username: faker.internet.username(),
    password: faker.internet.password(),
    phone: faker.phone.number(),
    gender: faker.helpers.arrayElement(Object.values(Gender)),
    status: faker.helpers.arrayElement(Object.values(UserStatus)),
    role: faker.helpers.arrayElement(Object.values(UserRole)),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
  });

  const mockUser = createMockUser();

  const mockPaginatedResult = {
    docs: [mockUser],
    totalDocs: 1,
    limit: 10,
    page: 1,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
    nextPage: null,
    prevPage: null,
  };

  beforeEach(async () => {
    const mockUserService = {
      create: jest.fn(),
      getUser: jest.fn(),
      getUsers: jest.fn(),
      updateUser: jest.fn(),
      softDeleteUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserResolver,
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    }).compile();

    resolver = module.get<UserResolver>(UserResolver);
    userService = module.get(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    it('should create a new user', async () => {
      const createUserInput: CreateUserInput = {
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: faker.internet.email(),
        password: faker.internet.password({ length: 12 }),
      };

      userService.create.mockResolvedValue(mockUser);

      const result = await resolver.createUser(createUserInput);

      expect(userService.create).toHaveBeenCalledWith(createUserInput);
      expect(result).toEqual(mockUser);
    });
  });

  describe('getUser', () => {
    it('should return a user when found', async () => {
      const getUserInput: GetUserInput = {
        _id: mockUser._id,
      };

      userService.getUser.mockResolvedValue(mockUser);

      const result = await resolver.getUser(getUserInput);

      expect(userService.getUser).toHaveBeenCalledWith(getUserInput);
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      const getUserInput: GetUserInput = {
        _id: new Types.ObjectId(),
      };

      userService.getUser.mockResolvedValue(null);

      await expect(resolver.getUser(getUserInput)).rejects.toThrow(
        NotFoundException,
      );
      expect(userService.getUser).toHaveBeenCalledWith(getUserInput);
    });
  });

  describe('getUsers', () => {
    it('should return paginated users', async () => {
      const paginateUserInput: PaginateUserInput = {
        page: faker.number.int({ min: 1, max: 10 }),
        limit: faker.number.int({ min: 5, max: 20 }),
        search: faker.person.firstName(),
      };

      userService.getUsers.mockResolvedValue(mockPaginatedResult);

      const result = await resolver.getUsers(paginateUserInput);

      expect(userService.getUsers).toHaveBeenCalledWith(paginateUserInput);
      expect(result).toEqual(mockPaginatedResult);
    });
  });

  describe('updateUser', () => {
    it('should update a user', async () => {
      const updateUserInput: UpdateUserInput = {
        _id: mockUser._id,
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
      };

      const updatedUser = { ...mockUser, ...updateUserInput };
      userService.updateUser.mockResolvedValue(updatedUser);

      const result = await resolver.updateUser(updateUserInput);

      expect(userService.updateUser).toHaveBeenCalledWith(updateUserInput._id, {
        firstName: updateUserInput.firstName,
        lastName: updateUserInput.lastName,
      });
      expect(result).toEqual(updatedUser);
    });

    it('should handle user not found during update', async () => {
      const updateUserInput: UpdateUserInput = {
        _id: new Types.ObjectId(),
        firstName: faker.person.firstName(),
      };

      userService.updateUser.mockResolvedValue(null);

      const result = await resolver.updateUser(updateUserInput);

      expect(result).toBeNull();
    });
  });

  describe('softDeleteUser', () => {
    it('should soft delete a user', async () => {
      const softDeleteUserInput: SoftDeleteUserInput = {
        _id: mockUser._id,
      };

      const deletedUser = { ...mockUser, status: UserStatus.DELETED };
      userService.softDeleteUser.mockResolvedValue(deletedUser);

      const result = await resolver.softDeleteUser(softDeleteUserInput);

      expect(userService.softDeleteUser).toHaveBeenCalledWith(
        softDeleteUserInput._id,
      );
      expect(result).toEqual(deletedUser);
    });

    it('should handle user not found during soft delete', async () => {
      const softDeleteUserInput: SoftDeleteUserInput = {
        _id: new Types.ObjectId(),
      };

      userService.softDeleteUser.mockResolvedValue(null);

      const result = await resolver.softDeleteUser(softDeleteUserInput);

      expect(result).toBeNull();
    });
  });
});
