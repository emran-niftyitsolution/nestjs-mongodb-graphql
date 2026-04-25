import { Args, Context, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { GqlExpressRequestContext } from '../common/interfaces/gql-express-request-context.interface';
import { User } from '../user/schema/user.schema';
import { AuthService } from './auth.service';
import {
  ChangePasswordInput,
  LoginInput,
  LoginResponse,
  LogoutAllInput,
  LogoutResult,
  PasswordChangeResult,
  PasswordResetRequestResult,
  RefreshTokenInput,
  RequestPasswordResetInput,
  ResetPasswordInput,
  RevokeSessionInput,
  SignupInput,
  UserSessionListEntry,
} from './dtos/auth.input';
import { buildSessionMetaFromRequest } from './utils/session-client-meta.util';

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Mutation(() => LoginResponse, { description: 'Login and get JWT token' })
  login(
    @Args('input') input: LoginInput,
    @Context() context: GqlExpressRequestContext,
  ): Promise<LoginResponse> {
    return this.authService.login(
      input,
      buildSessionMetaFromRequest(context.req),
    );
  }

  @Public()
  @Mutation(() => LoginResponse, { description: 'Signup and get JWT token' })
  signup(
    @Args('input') input: SignupInput,
    @Context() context: GqlExpressRequestContext,
  ): Promise<LoginResponse> {
    return this.authService.signup(
      input,
      buildSessionMetaFromRequest(context.req),
    );
  }

  @Public()
  @Mutation(() => LoginResponse, { description: 'Refresh JWT tokens' })
  refreshToken(
    @Args('input') input: RefreshTokenInput,
  ): Promise<LoginResponse> {
    return this.authService.refreshToken(input);
  }

  @Mutation(() => PasswordChangeResult, {
    description: 'Change password for the current user (requires login)',
  })
  changePassword(
    @CurrentUser() user: User,
    @Args('input') input: ChangePasswordInput,
  ): Promise<PasswordChangeResult> {
    return this.authService.changePassword(user, input);
  }

  @Public()
  @Mutation(() => PasswordResetRequestResult, {
    description: 'Request a password reset token by email',
  })
  requestPasswordReset(
    @Args('input') input: RequestPasswordResetInput,
  ): Promise<PasswordResetRequestResult> {
    return this.authService.requestPasswordReset(input);
  }

  @Public()
  @Mutation(() => PasswordChangeResult, {
    description: 'Reset password using a valid reset token',
  })
  resetPassword(
    @Args('input') input: ResetPasswordInput,
  ): Promise<PasswordChangeResult> {
    return this.authService.resetPassword(input);
  }

  @Mutation(() => LogoutResult, { description: 'Log out the current device' })
  logout(
    @CurrentUser() user: User,
    @Context() context: GqlExpressRequestContext,
  ): Promise<LogoutResult> {
    const authorizationHeader = context.req.headers.authorization;
    return this.authService.logoutCurrent(user, authorizationHeader);
  }

  @Mutation(() => LogoutResult, {
    description:
      'Log out on every device. Super admin may pass forUserId to end all sessions for that user.',
  })
  logoutAll(
    @CurrentUser() user: User,
    @Args('input', { type: () => LogoutAllInput, nullable: true })
    input?: LogoutAllInput | null,
  ): Promise<LogoutResult> {
    return this.authService.logoutAll(user, input);
  }

  @Mutation(() => LogoutResult, {
    description:
      'End one session. Super admin may revoke any session id; others only their own.',
  })
  revokeSession(
    @CurrentUser() user: User,
    @Args('input') input: RevokeSessionInput,
  ): Promise<LogoutResult> {
    return this.authService.revokeSession(user, input);
  }

  @Query(() => [UserSessionListEntry], {
    description:
      'List active sessions. Super admin may pass userId to list another user’s sessions.',
  })
  mySessions(
    @CurrentUser() user: User,
    @Context() context: GqlExpressRequestContext,
    @Args('userId', { type: () => ID, nullable: true }) userId?: string | null,
  ): Promise<UserSessionListEntry[]> {
    return this.authService.mySessions(
      user,
      context.req.headers.authorization,
      userId,
    );
  }
}
