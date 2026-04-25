import { createHash, randomBytes } from 'node:crypto';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import dayjs from 'dayjs';
import { Types } from 'mongoose';

// CJS `module.exports = fn` — default import compiles to `.default` and breaks at runtime.
import ms = require('ms');

import { REQUEST_MESSAGES } from '../common/constants/request-messages.constants';
import { extractBearer } from '../common/utils/extract-bearer.util';
import type { AppEnv } from '../config/env.validation';
import { User } from '../user/schema/user.schema';
import { UserService } from '../user/user.service';
import type {
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
import type { JwtPayload, Tokens } from './interfaces/jwt.interface';
import type { SessionClientMeta } from './interfaces/session-client-meta.interface';
import { SessionService } from './session.service';
import { mergeClientMeta } from './utils/session-client-meta.util';
import { assertSuperAdmin, isSuperAdmin } from './utils/super-admin.util';
import { mapUserSessionsToListEntries } from './utils/user-session-list.mapper';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly sessionService: SessionService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppEnv, true>,
  ) {}

  private getTokens(
    userClaims: Pick<JwtPayload, 'sub' | 'email'>,
    sessionId: string,
  ): Tokens {
    const jwtPayload: JwtPayload = { ...userClaims, sessionId };
    const accessToken = this.jwtService.sign(
      {
        sub: jwtPayload.sub,
        email: jwtPayload.email,
        sessionId: jwtPayload.sessionId,
      },
      {
        secret: this.configService.getOrThrow('ACCESS_TOKEN_SECRET'),
        expiresIn: this.configService.getOrThrow('ACCESS_TOKEN_EXPIRES_IN'),
      },
    );
    const refreshToken = this.jwtService.sign(
      {
        sub: jwtPayload.sub,
        email: jwtPayload.email,
        sessionId: jwtPayload.sessionId,
      },
      {
        secret: this.configService.getOrThrow('REFRESH_TOKEN_SECRET'),
        expiresIn: this.configService.getOrThrow('REFRESH_TOKEN_EXPIRES_IN'),
      },
    );
    return { accessToken, refreshToken };
  }

  private computeRefreshExpiryDate(): Date {
    const expiresIn = this.configService.getOrThrow('REFRESH_TOKEN_EXPIRES_IN');
    if (typeof expiresIn === 'number') {
      return dayjs().add(expiresIn, 'second').toDate();
    }
    const parsed = (ms as unknown as (input: string) => number | undefined)(
      String(expiresIn),
    );
    if (parsed === undefined || !Number.isFinite(parsed) || parsed <= 0) {
      // Env is validated, so this should never happen in practice.
      return dayjs().toDate();
    }
    return dayjs().add(parsed, 'millisecond').toDate();
  }

  private async openSessionWithTokens(
    user: User,
    sessionMeta?: SessionClientMeta,
  ): Promise<LoginResponse> {
    const newSessionId = new Types.ObjectId();
    const userClaims = { sub: user._id.toString(), email: user.email };
    const tokens = this.getTokens(userClaims, newSessionId.toString());
    const refreshExpiresAt = this.computeRefreshExpiryDate();
    await this.sessionService.createForLogin(
      newSessionId,
      user._id,
      tokens.refreshToken,
      refreshExpiresAt,
      sessionMeta,
    );
    await this.sessionService.revokeOldestActiveSessionsBeyondLimit(
      user._id,
      this.configService.getOrThrow('MAX_ACTIVE_SESSIONS_PER_USER'),
    );
    return { ...tokens, user };
  }

  async login(
    input: LoginInput,
    sessionMeta?: SessionClientMeta,
  ): Promise<LoginResponse> {
    const user = await this.userService.getUser({ email: input.email });
    if (!user)
      throw new UnauthorizedException(REQUEST_MESSAGES.INVALID_CREDENTIALS);

    const passwordMatches = await argon2.verify(user.password, input.password);
    if (!passwordMatches) {
      throw new UnauthorizedException(REQUEST_MESSAGES.INVALID_CREDENTIALS);
    }

    return this.openSessionWithTokens(
      user,
      mergeClientMeta(
        input.deviceName !== undefined ? { deviceName: input.deviceName } : {},
        sessionMeta,
      ),
    );
  }

  async signup(
    input: SignupInput,
    sessionMeta?: SessionClientMeta,
  ): Promise<LoginResponse> {
    const user = await this.userService.create({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      password: input.password,
    });
    return this.openSessionWithTokens(
      user,
      mergeClientMeta(
        input.deviceName !== undefined ? { deviceName: input.deviceName } : {},
        sessionMeta,
      ),
    );
  }

  async refreshToken(input: RefreshTokenInput): Promise<LoginResponse> {
    const refreshTokenSecret = this.configService.getOrThrow(
      'REFRESH_TOKEN_SECRET',
    );
    let refreshTokenPayload: JwtPayload;
    try {
      refreshTokenPayload = this.jwtService.verify<JwtPayload>(
        input.refreshToken,
        {
          secret: refreshTokenSecret,
        },
      );
    } catch {
      throw new UnauthorizedException(REQUEST_MESSAGES.INVALID_REFRESH_TOKEN);
    }
    if (!Types.ObjectId.isValid(refreshTokenPayload.sub)) {
      throw new UnauthorizedException(REQUEST_MESSAGES.INVALID_REFRESH_TOKEN);
    }
    if (
      !refreshTokenPayload.sessionId ||
      !Types.ObjectId.isValid(refreshTokenPayload.sessionId)
    ) {
      throw new UnauthorizedException(REQUEST_MESSAGES.INVALID_REFRESH_TOKEN);
    }
    const userObjectId = new Types.ObjectId(refreshTokenPayload.sub);
    const sessionObjectId = new Types.ObjectId(refreshTokenPayload.sessionId);
    const activeSession = await this.sessionService.getActiveById(
      sessionObjectId,
      userObjectId,
    );
    if (!activeSession) {
      throw new UnauthorizedException(REQUEST_MESSAGES.INVALID_REFRESH_TOKEN);
    }
    const clientRefreshTokenMatchesStoredHash = await argon2.verify(
      activeSession.refreshTokenHash,
      input.refreshToken,
    );
    if (!clientRefreshTokenMatchesStoredHash) {
      await this.sessionService.revoke(sessionObjectId, userObjectId);
      throw new UnauthorizedException(REQUEST_MESSAGES.INVALID_REFRESH_TOKEN);
    }
    const user = await this.userService.getUser({ _id: userObjectId });
    if (!user)
      throw new UnauthorizedException(REQUEST_MESSAGES.INVALID_REFRESH_TOKEN);

    const tokens = this.getTokens(
      { sub: user._id.toString(), email: user.email },
      sessionObjectId.toString(),
    );
    const refreshExpiresAt = this.computeRefreshExpiryDate();
    const refreshHashWasUpdated = await this.sessionService.setRefreshTokenHash(
      sessionObjectId,
      userObjectId,
      tokens.refreshToken,
      refreshExpiresAt,
    );
    if (!refreshHashWasUpdated) {
      throw new UnauthorizedException(REQUEST_MESSAGES.INVALID_REFRESH_TOKEN);
    }
    return { ...tokens, user };
  }

  async logoutCurrent(
    user: User,
    authorization: string | undefined,
  ): Promise<LogoutResult> {
    const accessTokenString = extractBearer(authorization);
    if (!accessTokenString) {
      throw new UnauthorizedException(REQUEST_MESSAGES.MISSING_ACCESS_TOKEN);
    }
    const accessTokenSecret = this.configService.getOrThrow(
      'ACCESS_TOKEN_SECRET',
    );
    let accessTokenPayload: JwtPayload;
    try {
      accessTokenPayload = this.jwtService.verify<JwtPayload>(
        accessTokenString,
        {
          secret: accessTokenSecret,
        },
      );
    } catch {
      throw new UnauthorizedException(REQUEST_MESSAGES.INVALID_ACCESS_TOKEN);
    }
    if (accessTokenPayload.sub !== user._id.toString()) {
      throw new UnauthorizedException(REQUEST_MESSAGES.INVALID_ACCESS_TOKEN);
    }
    if (
      !accessTokenPayload.sessionId ||
      !Types.ObjectId.isValid(accessTokenPayload.sessionId)
    ) {
      throw new UnauthorizedException(REQUEST_MESSAGES.INVALID_ACCESS_TOKEN);
    }
    await this.sessionService.revoke(
      new Types.ObjectId(accessTokenPayload.sessionId),
      user._id,
    );
    return { success: true };
  }

  async logoutAll(
    user: User,
    input?: LogoutAllInput | null,
  ): Promise<LogoutResult> {
    const targetUserIdToSignOutAllSessions = input?.forUserId;
    if (
      targetUserIdToSignOutAllSessions !== undefined &&
      targetUserIdToSignOutAllSessions.length > 0
    ) {
      assertSuperAdmin(user);
      if (!Types.ObjectId.isValid(targetUserIdToSignOutAllSessions)) {
        throw new NotFoundException(REQUEST_MESSAGES.USER_NOT_FOUND);
      }
      await this.sessionService.revokeAllForUser(
        new Types.ObjectId(targetUserIdToSignOutAllSessions),
      );
    } else {
      await this.sessionService.revokeAllForUser(user._id);
    }
    return { success: true };
  }

  async mySessions(
    user: User,
    authorization: string | undefined,
    otherUserIdForAdminsToView?: string | null,
  ): Promise<UserSessionListEntry[]> {
    let sessionsOwnerUserId = user._id;
    if (
      otherUserIdForAdminsToView !== undefined &&
      otherUserIdForAdminsToView !== null
    ) {
      const trimmedOtherUserId = otherUserIdForAdminsToView.trim();
      if (trimmedOtherUserId.length > 0) {
        if (!isSuperAdmin(user)) {
          throw new ForbiddenException(REQUEST_MESSAGES.SUPER_ADMIN_ONLY);
        }
        if (!Types.ObjectId.isValid(trimmedOtherUserId)) {
          throw new NotFoundException(REQUEST_MESSAGES.USER_NOT_FOUND);
        }
        sessionsOwnerUserId = new Types.ObjectId(trimmedOtherUserId);
      }
    }
    const activeSessions =
      await this.sessionService.listActiveForUser(sessionsOwnerUserId);
    let currentCallerSessionId: string | null = null;
    const accessTokenString = extractBearer(authorization);
    if (accessTokenString) {
      try {
        const accessTokenPayload = this.jwtService.verify<JwtPayload>(
          accessTokenString,
          {
            secret: this.configService.getOrThrow('ACCESS_TOKEN_SECRET'),
          },
        );
        if (accessTokenPayload.sessionId) {
          currentCallerSessionId = accessTokenPayload.sessionId;
        }
      } catch {
        currentCallerSessionId = null;
      }
    }
    return mapUserSessionsToListEntries(activeSessions, currentCallerSessionId);
  }

  async revokeSession(
    user: User,
    input: RevokeSessionInput,
  ): Promise<LogoutResult> {
    if (!Types.ObjectId.isValid(input.sessionId)) {
      throw new NotFoundException(REQUEST_MESSAGES.SESSION_NOT_FOUND);
    }
    const sessionToRevokeId = new Types.ObjectId(input.sessionId);
    const sessionWasRevoked = isSuperAdmin(user)
      ? await this.sessionService.revokeBySessionIdGlobal(sessionToRevokeId)
      : await this.sessionService.revoke(sessionToRevokeId, user._id);
    if (!sessionWasRevoked) {
      throw new NotFoundException(REQUEST_MESSAGES.SESSION_NOT_FOUND);
    }
    return { success: true };
  }

  async changePassword(
    user: User,
    input: ChangePasswordInput,
  ): Promise<PasswordChangeResult> {
    const freshUser = await this.userService.getUser({ _id: user._id });
    if (!freshUser) {
      throw new UnauthorizedException(REQUEST_MESSAGES.INVALID_CREDENTIALS);
    }

    const passwordMatches = await argon2.verify(
      freshUser.password,
      input.currentPassword,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException(REQUEST_MESSAGES.INVALID_CREDENTIALS);
    }

    await this.userService.setPassword(freshUser._id, input.newPassword);
    await this.userService.clearPasswordResetToken(freshUser._id);
    await this.sessionService.revokeAllForUser(freshUser._id);
    return { success: true };
  }

  async requestPasswordReset(
    input: RequestPasswordResetInput,
  ): Promise<PasswordResetRequestResult> {
    const user = await this.userService.getUser({ email: input.email });
    if (!user) {
      return { success: true };
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = dayjs().add(60, 'minute').toDate();
    await this.userService.setPasswordResetToken(
      user._id,
      tokenHash,
      expiresAt,
    );

    return { success: true, resetToken: token };
  }

  async resetPassword(
    input: ResetPasswordInput,
  ): Promise<PasswordChangeResult> {
    const tokenHash = createHash('sha256').update(input.token).digest('hex');
    const user = await this.userService.getUser({
      passwordResetTokenHash: tokenHash,
    });
    if (
      !user ||
      user.passwordResetTokenExpiresAt?.getTime() === undefined ||
      user.passwordResetTokenExpiresAt.getTime() < Date.now()
    ) {
      throw new UnauthorizedException(REQUEST_MESSAGES.INVALID_CREDENTIALS);
    }

    await this.userService.setPassword(user._id, input.newPassword);
    await this.userService.clearPasswordResetToken(user._id);
    await this.sessionService.revokeAllForUser(user._id);
    return { success: true };
  }
}
