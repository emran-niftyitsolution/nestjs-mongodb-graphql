import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Types } from 'mongoose';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AppEnv } from '../../config/env.validation';
import type { User } from '../../user/schema/user.schema';
import { UserService } from '../../user/user.service';
import type { JwtPayload } from '../interfaces/jwt.interface';
import { SessionService } from '../session.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService<AppEnv, true>,
    private readonly userService: UserService,
    private readonly sessionService: SessionService,
  ) {
    const secret = configService.getOrThrow('ACCESS_TOKEN_SECRET');
    if (!secret) {
      throw new InternalServerErrorException(
        'ACCESS_TOKEN_SECRET is not defined in configuration',
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  override async validate(payload: JwtPayload): Promise<User> {
    if (!Types.ObjectId.isValid(payload.sub)) {
      throw new UnauthorizedException('Invalid token');
    }
    if (!payload.sessionId || !Types.ObjectId.isValid(payload.sessionId)) {
      throw new UnauthorizedException('Invalid token');
    }
    const userObjectId = new Types.ObjectId(payload.sub);
    const user = await this.userService.getUser({ _id: userObjectId });
    if (!user) {
      throw new UnauthorizedException('Invalid token');
    }
    const sessionIdFromToken = new Types.ObjectId(payload.sessionId);
    const isSessionActive = await this.sessionService.isActive(
      sessionIdFromToken,
      userObjectId,
    );
    if (!isSessionActive) {
      throw new UnauthorizedException('Session has ended');
    }
    return user;
  }
}
