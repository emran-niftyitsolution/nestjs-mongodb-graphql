import { faker } from '@faker-js/faker';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { Gender, UserRole, UserStatus } from '../user/schema/user.schema';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';
import { LoginInput, RefreshTokenInput, SignupInput } from './dtos/auth.input';

describe('AuthResolver', () => {
  let resolver: AuthResolver;
  let authService: jest.Mocked<AuthService>;

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

  const mockLoginResponse = {
    accessToken: faker.string.alphanumeric(64),
    refreshToken: faker.string.alphanumeric(64),
    user: mockUser,
  };

  beforeEach(async () => {
    const mockAuthService = {
      login: jest.fn(),
      signup: jest.fn(),
      refreshToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthResolver,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    resolver = module.get<AuthResolver>(AuthResolver);
    authService = module.get(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should return login response with tokens and user', async () => {
      const loginInput: LoginInput = {
        username: faker.internet.userName(),
        password: faker.internet.password({ length: 12 }),
      };

      authService.login.mockResolvedValue(mockLoginResponse);

      const result = await resolver.login(loginInput);

      expect(authService.login).toHaveBeenCalledWith(loginInput);
      expect(result).toEqual(mockLoginResponse);
    });
  });

  describe('signup', () => {
    it('should return signup response with tokens and user', async () => {
      const signupInput: SignupInput = {
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: faker.internet.email(),
        password: faker.internet.password({ length: 12 }),
      };

      authService.signup.mockResolvedValue(mockLoginResponse);

      const result = await resolver.signup(signupInput);

      expect(authService.signup).toHaveBeenCalledWith(signupInput);
      expect(result).toEqual(mockLoginResponse);
    });
  });

  describe('refreshToken', () => {
    it('should return new tokens when refresh token is valid', async () => {
      const refreshTokenInput: RefreshTokenInput = {
        refreshToken: faker.string.alphanumeric(64),
      };

      authService.refreshToken.mockResolvedValue(mockLoginResponse);

      const result = await resolver.refreshToken(refreshTokenInput);

      expect(authService.refreshToken).toHaveBeenCalledWith(refreshTokenInput);
      expect(result).toEqual(mockLoginResponse);
    });
  });
});
