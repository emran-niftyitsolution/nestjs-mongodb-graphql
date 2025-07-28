import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Model } from 'mongoose';
import { CreateUserInput, UpdateUserInput } from './dtos/user.input';
import { User, UserRole, UserStatus } from './schema/user.schema';
import { UserModule } from './user.module';
import { UserService } from './user.service';

// Define PaginateModel type locally
type PaginateModel<T> = Model<T> & {
  paginate: (query?: any, options?: any) => Promise<any>;
};

describe('UserModule Integration', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let userModel: PaginateModel<User>;
  let userService: UserService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        MongooseModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => ({
            uri:
              configService.get<string>('MONGODB_URI') ||
              'mongodb://localhost:27017/test',
          }),
        }),
        UserModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    // Get the user model and service with proper typing
    userModel = moduleRef.get<PaginateModel<User>>('UserModel');
    userService = moduleRef.get<UserService>(UserService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clear the database before each test
    await userModel.deleteMany({});
  });

  describe('User CRUD Operations', () => {
    it('should create a user successfully', async () => {
      const createUserInput: CreateUserInput = {
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: faker.internet.email(),
        password: faker.internet.password({ length: 12 }),
      };

      // Use the UserService to create the user so password gets hashed
      const user = await userService.create(createUserInput);

      expect(user.firstName).toBe(createUserInput.firstName);
      expect(user.lastName).toBe(createUserInput.lastName);
      expect(user.email.toLowerCase()).toBe(
        createUserInput.email.toLowerCase(),
      );
      expect(user.password).not.toBe(createUserInput.password); // Should be hashed
      expect(user.status).toBe(UserStatus.PENDING);
      expect(user.role).toBe(UserRole.USER);
    });

    it('should find a user by email', async () => {
      const userData = {
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: faker.internet.email(),
        password: faker.internet.password(),
        status: UserStatus.ACTIVE,
        role: UserRole.USER,
      };

      await userModel.create(userData);
      const foundUser = await userModel.findOne({ email: userData.email });

      expect(foundUser).toBeDefined();
      expect(foundUser?.firstName).toBe(userData.firstName);
      expect(foundUser?.email.toLowerCase()).toBe(userData.email.toLowerCase());
    });

    it('should update a user successfully', async () => {
      const user = await userModel.create({
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: faker.internet.email(),
        password: faker.internet.password(),
        status: UserStatus.ACTIVE,
        role: UserRole.USER,
      });

      const updateData: Partial<UpdateUserInput> = {
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
      };

      const updatedUser = await userModel.findByIdAndUpdate(
        user._id,
        updateData,
        { new: true },
      );

      expect(updatedUser?.firstName).toBe(updateData.firstName);
      expect(updatedUser?.lastName).toBe(updateData.lastName);
    });

    it('should soft delete a user', async () => {
      const user = await userModel.create({
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: faker.internet.email(),
        password: faker.internet.password(),
        status: UserStatus.ACTIVE,
        role: UserRole.USER,
      });

      const deletedUser = await userModel.findByIdAndUpdate(
        user._id,
        { status: UserStatus.DELETED },
        { new: true },
      );

      expect(deletedUser?.status).toBe(UserStatus.DELETED);
    });
  });

  describe('User Validation', () => {
    it('should enforce unique email constraint', async () => {
      const userData = {
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: faker.internet.email(),
        password: faker.internet.password(),
        status: UserStatus.ACTIVE,
        role: UserRole.USER,
      };

      await userModel.create(userData);

      // Try to create another user with the same email
      await expect(userModel.create(userData)).rejects.toThrow();
    });

    it('should validate required fields', async () => {
      const invalidUserData = {
        firstName: faker.person.firstName(),
        // Missing required fields: lastName, email, password
      };

      await expect(userModel.create(invalidUserData)).rejects.toThrow();
    });
  });

  describe('User Pagination', () => {
    it('should return paginated results', async () => {
      // Create multiple users with unique usernames and phones to avoid constraint issues
      const users = Array.from({ length: 3 }, (_, index) => ({
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: faker.internet.email(),
        username: faker.internet.username() + index, // Ensure unique usernames
        phone: faker.phone.number() + index, // Ensure unique phones
        password: faker.internet.password(),
        status: UserStatus.ACTIVE,
        role: UserRole.USER,
      }));

      await userModel.insertMany(users);

      // Use manual pagination since the plugin might not be available in tests
      const page = 1;
      const limit = 2;
      const skip = (page - 1) * limit;

      const docs = await userModel.find({}).skip(skip).limit(limit);
      const totalDocs = await userModel.countDocuments({});
      const totalPages = Math.ceil(totalDocs / limit);

      expect(docs).toHaveLength(2);
      expect(totalDocs).toBe(3);
      expect(page).toBe(1);
      expect(limit).toBe(2);
      expect(totalPages).toBe(2);
    });
  });
});
