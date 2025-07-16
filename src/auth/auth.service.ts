import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { UserService } from '../user/user.service';
import { LoginInput, LoginResponse } from './dtos/auth.input';
import { JwtPayload } from './interfaces/jwt.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private getTokens(input: JwtPayload) {
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
    const user = await this.userService.getUser({ username: input.username });
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
}
