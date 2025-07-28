import { faker } from '@faker-js/faker';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { Types } from 'mongoose';
import { Gender, UserRole, UserStatus } from '../user/schema/user.schema';
import { UserService } from '../user/user.service';
import { AuthService } from './auth.service';
import { LoginInput, RefreshTokenInput, SignupInput } from './dtos/auth.input';

describe('AuthService', () => {
  let service: AuthService;
  let userService: jest.Mocked<UserService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

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

  const mockTokens = {
    accessToken: faker.string.alphanumeric(64),
    refreshToken: faker.string.alphanumeric(64),
  };

  beforeEach(async () => {
    const mockUserService = {
      getUser: jest.fn(),
      create: jest.fn(),
    };

    const mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get(UserService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);

    // Mock argon2 manually
    jest
      .spyOn(argon2, 'verify')
      .mockImplementation(() => Promise.resolve(true));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should return tokens and user when credentials are valid', async () => {
      const loginInput: LoginInput = {
        username: faker.internet.userName(),
        password: faker.internet.password({ length: 12 }),
      };

      userService.getUser.mockResolvedValue(mockUser);
      jwtService.sign
        .mockReturnValueOnce(mockTokens.accessToken)
        .mockReturnValueOnce(mockTokens.refreshToken);
      configService.get
        .mockReturnValueOnce('access-secret')
        .mockReturnValueOnce('refresh-secret');

      const result = await service.login(loginInput);

      expect(userService.getUser).toHaveBeenCalledWith({
        username: loginInput.username,
      });
      expect(argon2.verify).toHaveBeenCalledWith(
        mockUser.password,
        loginInput.password,
      );
      expect(jwtService.sign).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        ...mockTokens,
        user: mockUser,
      });
    });

    it('should throw UnauthorizedException when user not found', async () => {
      const loginInput: LoginInput = {
        username: faker.internet.userName(),
        password: faker.internet.password({ length: 12 }),
      };

      userService.getUser.mockResolvedValue(null);

      await expect(service.login(loginInput)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(userService.getUser).toHaveBeenCalledWith({
        username: loginInput.username,
      });
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      const loginInput: LoginInput = {
        username: faker.internet.userName(),
        password: faker.internet.password({ length: 12 }),
      };

      userService.getUser.mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginInput)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(argon2.verify).toHaveBeenCalledWith(
        mockUser.password,
        loginInput.password,
      );
    });
  });

  describe('signup', () => {
    it('should create user and return tokens', async () => {
      const signupInput: SignupInput = {
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: faker.internet.email(),
        password: faker.internet.password({ length: 12 }),
      };

      userService.create.mockResolvedValue(mockUser);
      jwtService.sign
        .mockReturnValueOnce(mockTokens.accessToken)
        .mockReturnValueOnce(mockTokens.refreshToken);
      configService.get
        .mockReturnValueOnce('access-secret')
        .mockReturnValueOnce('refresh-secret');

      const result = await service.signup(signupInput);

      expect(userService.create).toHaveBeenCalledWith(signupInput);
      expect(jwtService.sign).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        ...mockTokens,
        user: mockUser,
      });
    });
  });

  describe('refreshToken', () => {
    it('should return new tokens when refresh token is valid', async () => {
      const refreshTokenInput: RefreshTokenInput = {
        refreshToken: faker.string.alphanumeric(64),
      };

      const mockPayload = {
        sub: mockUser._id,
        email: mockUser.email,
      };

      jwtService.verify.mockReturnValue(mockPayload);
      userService.getUser.mockResolvedValue(mockUser);
      jwtService.sign
        .mockReturnValueOnce(mockTokens.accessToken)
        .mockReturnValueOnce(mockTokens.refreshToken);
      configService.get
        .mockReturnValueOnce('refresh-secret')
        .mockReturnValueOnce('access-secret')
        .mockReturnValueOnce('refresh-secret');

      const result = await service.refreshToken(refreshTokenInput);

      expect(jwtService.verify).toHaveBeenCalledWith(
        refreshTokenInput.refreshToken,
        {
          secret: 'refresh-secret',
        },
      );
      expect(userService.getUser).toHaveBeenCalledWith({
        _id: mockPayload.sub,
      });
      expect(jwtService.sign).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        ...mockTokens,
        user: mockUser,
      });
    });

    it('should throw UnauthorizedException when refresh token is invalid', async () => {
      const refreshTokenInput: RefreshTokenInput = {
        refreshToken: faker.string.alphanumeric(64),
      };

      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });
      configService.get.mockReturnValue('refresh-secret');

      await expect(service.refreshToken(refreshTokenInput)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(jwtService.verify).toHaveBeenCalledWith(
        refreshTokenInput.refreshToken,
        {
          secret: 'refresh-secret',
        },
      );
    });

    it('should throw UnauthorizedException when user not found', async () => {
      const refreshTokenInput: RefreshTokenInput = {
        refreshToken: faker.string.alphanumeric(64),
      };

      const mockPayload = {
        sub: new Types.ObjectId(),
        email: faker.internet.email(),
      };

      jwtService.verify.mockReturnValue(mockPayload);
      userService.getUser.mockResolvedValue(null);
      configService.get.mockReturnValue('refresh-secret');

      await expect(service.refreshToken(refreshTokenInput)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(userService.getUser).toHaveBeenCalledWith({
        _id: mockPayload.sub,
      });
    });
  });

  describe('getTokens', () => {
    it('should generate access and refresh tokens', () => {
      const payload = {
        sub: mockUser._id,
        email: mockUser.email,
      };

      jwtService.sign
        .mockReturnValueOnce(mockTokens.accessToken)
        .mockReturnValueOnce(mockTokens.refreshToken);
      configService.get
        .mockReturnValueOnce('access-secret')
        .mockReturnValueOnce('refresh-secret');

      // Access private method through service instance
      const result = (service as any).getTokens(payload);

      expect(jwtService.sign).toHaveBeenCalledWith(
        {
          sub: payload.sub,
          email: payload.email,
        },
        {
          secret: 'access-secret',
          expiresIn: '1d',
        },
      );
      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: payload.sub, email: payload.email },
        {
          secret: 'refresh-secret',
          expiresIn: '7d',
        },
      );
      expect(result).toEqual(mockTokens);
    });
  });
});
