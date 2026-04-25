import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Types } from 'mongoose';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { REQUEST_MESSAGES } from '../../common/constants/request-messages.constants';
import type { AppEnv } from '../../config/env.validation';
import type { User } from '../../user/schema/user.schema';
import { UserService } from '../../user/user.service';
import type { JwtPayload } from '../interfaces/jwt.interface';
import { SessionService } from '../session.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private static readonly LAST_ACTIVE_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

  constructor(
    private readonly configService: ConfigService<AppEnv, true>,
    private readonly userService: UserService,
    private readonly sessionService: SessionService,
  ) {
    const secret = configService.getOrThrow('ACCESS_TOKEN_SECRET');
    if (!secret) {
      throw new InternalServerErrorException(
        REQUEST_MESSAGES.ACCESS_TOKEN_SECRET_NOT_DEFINED,
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
      throw new UnauthorizedException(REQUEST_MESSAGES.INVALID_TOKEN);
    }
    if (!payload.sessionId || !Types.ObjectId.isValid(payload.sessionId)) {
      throw new UnauthorizedException(REQUEST_MESSAGES.INVALID_TOKEN);
    }
    const userObjectId = new Types.ObjectId(payload.sub);
    const user = await this.userService.getUser({ _id: userObjectId });
    if (!user) {
      throw new UnauthorizedException(REQUEST_MESSAGES.INVALID_TOKEN);
    }
    const sessionIdFromToken = new Types.ObjectId(payload.sessionId);
    const isSessionActive = await this.sessionService.isActive(
      sessionIdFromToken,
      userObjectId,
    );
    if (!isSessionActive) {
      throw new UnauthorizedException(REQUEST_MESSAGES.SESSION_HAS_ENDED);
    }
    await this.sessionService.touchLastActiveAtIfStale(
      sessionIdFromToken,
      userObjectId,
      JwtStrategy.LAST_ACTIVE_TOUCH_INTERVAL_MS,
    );
    return user;
  }
}
