import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import {
  LoginInput,
  LoginResponse,
  RefreshTokenInput,
} from './dtos/auth.input';

@Public()
@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation(() => LoginResponse, { description: 'Login and get JWT token' })
  async login(@Args('input') input: LoginInput): Promise<LoginResponse> {
    return this.authService.login(input);
  }

  @Mutation(() => LoginResponse, { description: 'Refresh JWT tokens' })
  async refreshToken(
    @Args('input') input: RefreshTokenInput,
  ): Promise<LoginResponse> {
    return this.authService.refreshToken(input);
  }
}
