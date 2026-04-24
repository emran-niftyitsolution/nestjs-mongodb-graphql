import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from '../user/user.module';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';
import { UserSession, UserSessionSchema } from './schemas/user-session.schema';
import { SessionService } from './session.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    JwtModule,
    UserModule,
    MongooseModule.forFeature([
      { name: UserSession.name, schema: UserSessionSchema },
    ]),
  ],
  providers: [AuthResolver, AuthService, SessionService, JwtStrategy],
})
export class AuthModule {}
