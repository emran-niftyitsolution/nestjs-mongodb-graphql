import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { User } from '../../user/schema/user.schema';
import { UserService } from '../../user/user.service';
import { JwtPayload } from '../interfaces/jwt.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {
    const secret = configService.get<string>('ACCESS_TOKEN_SECRET');
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

  async validate(payload: JwtPayload): Promise<User | null> {
    const user = await this.userService.getUser({
      _id: payload.sub,
    });
    if (!user) {
      throw new UnauthorizedException('Invalid token');
    }
    return user;
  }
}
