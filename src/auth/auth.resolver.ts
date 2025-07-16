import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { LoginInput, LoginResponse } from './dtos/auth.input';

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation(() => LoginResponse, { description: 'Login and get JWT token' })
  async login(@Args('input') input: LoginInput): Promise<LoginResponse> {
    return this.authService.login(input);
  }
}
