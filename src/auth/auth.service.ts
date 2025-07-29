import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { UserService } from '../user/user.service';
import {
  LoginInput,
  LoginResponse,
  RefreshTokenInput,
  SignupInput,
} from './dtos/auth.input';
import { JwtPayload, Tokens } from './interfaces/jwt.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private getTokens(input: JwtPayload): Tokens {
    const accessToken = this.jwtService.sign(
      {
        sub: input.sub,
        email: input.email,
      },
      {
        secret: this.configService.get<string>('ACCESS_TOKEN_SECRET'),
        expiresIn: '1d',
      },
    );

    const refreshToken = this.jwtService.sign(
      { sub: input.sub, email: input.email },
      {
        secret: this.configService.get<string>('REFRESH_TOKEN_SECRET'),
        expiresIn: '7d',
      },
    );

    return {
      accessToken,
      refreshToken,
    };
  }

  async login(input: LoginInput): Promise<LoginResponse> {
    const user = await this.userService.getUser({ email: input.email });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await argon2.verify(user.password, input.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return {
      ...this.getTokens({
        sub: user._id,
        email: user.email,
      }),
      user,
    };
  }

  async signup(input: SignupInput): Promise<LoginResponse> {
    const user = await this.userService.create(input);
    return {
      ...this.getTokens({ sub: user._id, email: user.email }),
      user,
    };
  }

  async refreshToken(input: RefreshTokenInput): Promise<LoginResponse> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(input.refreshToken, {
        secret: this.configService.get<string>('REFRESH_TOKEN_SECRET'),
      });
      const user = await this.userService.getUser({ _id: payload.sub });
      if (!user) throw new UnauthorizedException('Invalid refresh token');
      return {
        ...this.getTokens({ sub: user._id, email: user.email }),
        user,
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
