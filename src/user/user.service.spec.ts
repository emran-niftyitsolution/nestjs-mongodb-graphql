import { faker } from '@faker-js/faker';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { Types } from 'mongoose';
import {
  CreateUserInput,
  PaginateUserInput,
  UpdateUserInput,
} from './dtos/user.input';
import { Gender, User, UserRole, UserStatus } from './schema/user.schema';
import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;
  let mockUserModel: {
    create: jest.Mock;
    findOne: jest.Mock;
    paginate: jest.Mock;
    findByIdAndUpdate: jest.Mock;
  };

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
    mockUserModel = {
      create: jest.fn(),
      findOne: jest.fn(),
      paginate: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);

    // Mock argon2 manually
    jest
      .spyOn(argon2, 'hash')
      .mockImplementation(() => Promise.resolve('hashedPassword'));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new user with hashed password', async () => {
      const createUserInput: CreateUserInput = {
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: faker.internet.email(),
        password: faker.internet.password({ length: 12 }),
      };

      const hashedPassword = faker.internet.password();
      (argon2.hash as jest.Mock).mockResolvedValue(hashedPassword);
      mockUserModel.create.mockResolvedValue(mockUser);

      const result = await service.create(createUserInput);

      expect(argon2.hash).toHaveBeenCalledWith(createUserInput.password);
      expect(mockUserModel.create).toHaveBeenCalledWith({
        ...createUserInput,
        password: hashedPassword,
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe('getUser', () => {
    it('should return a user when found', async () => {
      const query = { email: faker.internet.email() };
      mockUserModel.findOne.mockResolvedValue(mockUser);

      const result = await service.getUser(query);

      expect(mockUserModel.findOne).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      const query = { email: faker.internet.email() };
      mockUserModel.findOne.mockResolvedValue(null);

      const result = await service.getUser(query);

      expect(mockUserModel.findOne).toHaveBeenCalledWith(query);
      expect(result).toBeNull();
    });

    it('should build query correctly with multiple fields', async () => {
      const query = {
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: faker.internet.email(),
      };
      mockUserModel.findOne.mockResolvedValue(mockUser);

      await service.getUser(query);

      expect(mockUserModel.findOne).toHaveBeenCalledWith(query);
    });
  });

  describe('getUsers', () => {
    it('should return paginated users without search', async () => {
      const input: PaginateUserInput = {
        page: faker.number.int({ min: 1, max: 10 }),
        limit: faker.number.int({ min: 5, max: 20 }),
      };
      mockUserModel.paginate.mockResolvedValue(mockPaginatedResult);

      const result = await service.getUsers(input);

      expect(mockUserModel.paginate).toHaveBeenCalledWith(
        {},
        {
          page: input.page,
          limit: input.limit,
        },
      );
      expect(result).toEqual(mockPaginatedResult);
    });

    it('should return paginated users with search', async () => {
      const searchTerm = faker.person.firstName();
      const input: PaginateUserInput = {
        page: 1,
        limit: 10,
        search: searchTerm,
      };
      const expectedQuery = {
        $or: [
          { firstName: { $regex: searchTerm, $options: 'i' } },
          { lastName: { $regex: searchTerm, $options: 'i' } },
          { email: { $regex: searchTerm, $options: 'i' } },
          { username: { $regex: searchTerm, $options: 'i' } },
          { phone: { $regex: searchTerm, $options: 'i' } },
        ],
      };
      mockUserModel.paginate.mockResolvedValue(mockPaginatedResult);

      const result = await service.getUsers(input);

      expect(mockUserModel.paginate).toHaveBeenCalledWith(expectedQuery, {
        page: 1,
        limit: 10,
      });
      expect(result).toEqual(mockPaginatedResult);
    });

    it('should use default pagination values', async () => {
      const input: PaginateUserInput = {};
      mockUserModel.paginate.mockResolvedValue(mockPaginatedResult);

      await service.getUsers(input);

      expect(mockUserModel.paginate).toHaveBeenCalledWith(
        {},
        {
          page: 1,
          limit: 10,
        },
      );
    });
  });

  describe('updateUser', () => {
    it('should update user without password', async () => {
      const userId = new Types.ObjectId();
      const updateInput: Omit<UpdateUserInput, '_id'> = {
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
      };
      const updatedUser = { ...mockUser, ...updateInput };
      mockUserModel.findByIdAndUpdate.mockResolvedValue(updatedUser);

      const result = await service.updateUser(userId, updateInput);

      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        updateInput,
        { new: true },
      );
      expect(result).toEqual(updatedUser);
    });

    it('should update user with password hashing', async () => {
      const userId = new Types.ObjectId();
      const newPassword = faker.internet.password({ length: 12 });
      const updateInput: Omit<UpdateUserInput, '_id'> = {
        firstName: faker.person.firstName(),
        password: newPassword,
      };
      const hashedPassword = faker.internet.password();
      (argon2.hash as jest.Mock).mockResolvedValue(hashedPassword);
      const updatedUser = {
        ...mockUser,
        ...updateInput,
        password: hashedPassword,
      };
      mockUserModel.findByIdAndUpdate.mockResolvedValue(updatedUser);

      const result = await service.updateUser(userId, updateInput);

      expect(argon2.hash).toHaveBeenCalledWith(newPassword);
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        {
          ...updateInput,
          password: hashedPassword,
        },
        { new: true },
      );
      expect(result).toEqual(updatedUser);
    });

    it('should return null when user not found', async () => {
      const userId = new Types.ObjectId();
      const updateInput: Omit<UpdateUserInput, '_id'> = {
        firstName: faker.person.firstName(),
      };
      mockUserModel.findByIdAndUpdate.mockResolvedValue(null);

      const result = await service.updateUser(userId, updateInput);

      expect(result).toBeNull();
    });
  });

  describe('softDeleteUser', () => {
    it('should soft delete user by setting status to DELETED', async () => {
      const userId = new Types.ObjectId();
      const deletedUser = { ...mockUser, status: UserStatus.DELETED };
      mockUserModel.findByIdAndUpdate.mockResolvedValue(deletedUser);

      const result = await service.softDeleteUser(userId);

      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        { status: UserStatus.DELETED },
        { new: true },
      );
      expect(result).toEqual(deletedUser);
    });

    it('should return null when user not found', async () => {
      const userId = new Types.ObjectId();
      mockUserModel.findByIdAndUpdate.mockResolvedValue(null);

      const result = await service.softDeleteUser(userId);

      expect(result).toBeNull();
    });
  });

  describe('queryBuilder', () => {
    it('should build query with all fields', () => {
      const user = {
        _id: new Types.ObjectId(),
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: faker.internet.email(),
        username: faker.internet.userName(),
        phone: faker.phone.number(),
        gender: faker.helpers.arrayElement(Object.values(Gender)),
        status: faker.helpers.arrayElement(Object.values(UserStatus)),
        role: faker.helpers.arrayElement(Object.values(UserRole)),
      };

      const result = service.queryBuilder(user);

      expect(result).toEqual(user);
    });

    it('should build query with partial fields', () => {
      const user = {
        firstName: faker.person.firstName(),
        email: faker.internet.email(),
      };

      const result = service.queryBuilder(user);

      expect(result).toEqual({
        firstName: user.firstName,
        email: user.email,
      });
    });

    it('should return empty object for empty input', () => {
      const result = service.queryBuilder({});

      expect(result).toEqual({});
    });
  });
});
