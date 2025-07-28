import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import {
  LoginInput,
  LoginResponse,
  RefreshTokenInput,
  SignupInput,
} from './dtos/auth.input';

@Public()
@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation(() => LoginResponse, { description: 'Login and get JWT token' })
  login(@Args('input') input: LoginInput): Promise<LoginResponse> {
    return this.authService.login(input);
  }

  @Mutation(() => LoginResponse, { description: 'Signup and get JWT token' })
  signup(@Args('input') input: SignupInput): Promise<LoginResponse> {
    return this.authService.signup(input);
  }

  @Mutation(() => LoginResponse, { description: 'Refresh JWT tokens' })
  refreshToken(
    @Args('input') input: RefreshTokenInput,
  ): Promise<LoginResponse> {
    return this.authService.refreshToken(input);
  }
}
