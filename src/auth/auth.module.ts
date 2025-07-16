import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt'; // Assuming you have a JwtModule for JWT handling
import { UserModule } from '../user/user.module';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';

@Module({
  imports: [JwtModule, UserModule],
  providers: [AuthResolver, AuthService],
})
export class AuthModule {}
