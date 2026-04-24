import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { Types } from 'mongoose';
import { extractBearer } from '../common/utils/extract-bearer.util';
import type { AppEnv } from '../config/env.validation';
import { User } from '../user/schema/user.schema';
import { UserService } from '../user/user.service';
import type {
  LoginInput,
  LoginResponse,
  LogoutAllInput,
  LogoutResult,
  RefreshTokenInput,
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

  private async openSessionWithTokens(
    user: User,
    sessionMeta?: SessionClientMeta,
  ): Promise<LoginResponse> {
    const newSessionId = new Types.ObjectId();
    const userClaims = { sub: user._id.toString(), email: user.email };
    const tokens = this.getTokens(userClaims, newSessionId.toString());
    await this.sessionService.createForLogin(
      newSessionId,
      user._id,
      tokens.refreshToken,
      sessionMeta,
    );
    return { ...tokens, user };
  }

  async login(
    input: LoginInput,
    sessionMeta?: SessionClientMeta,
  ): Promise<LoginResponse> {
    const user = await this.userService.getUser({ email: input.email });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const passwordMatches = await argon2.verify(user.password, input.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
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
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (!Types.ObjectId.isValid(refreshTokenPayload.sub)) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (
      !refreshTokenPayload.sessionId ||
      !Types.ObjectId.isValid(refreshTokenPayload.sessionId)
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const userObjectId = new Types.ObjectId(refreshTokenPayload.sub);
    const sessionObjectId = new Types.ObjectId(refreshTokenPayload.sessionId);
    const activeSession = await this.sessionService.getActiveById(
      sessionObjectId,
      userObjectId,
    );
    if (!activeSession) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const clientRefreshTokenMatchesStoredHash = await argon2.verify(
      activeSession.refreshTokenHash,
      input.refreshToken,
    );
    if (!clientRefreshTokenMatchesStoredHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const user = await this.userService.getUser({ _id: userObjectId });
    if (!user) throw new UnauthorizedException('Invalid refresh token');

    const tokens = this.getTokens(
      { sub: user._id.toString(), email: user.email },
      sessionObjectId.toString(),
    );
    const refreshHashWasUpdated = await this.sessionService.setRefreshTokenHash(
      sessionObjectId,
      userObjectId,
      tokens.refreshToken,
    );
    if (!refreshHashWasUpdated) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return { ...tokens, user };
  }

  async logoutCurrent(
    user: User,
    authorization: string | undefined,
  ): Promise<LogoutResult> {
    const accessTokenString = extractBearer(authorization);
    if (!accessTokenString) {
      throw new UnauthorizedException('Missing access token');
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
      throw new UnauthorizedException('Invalid access token');
    }
    if (accessTokenPayload.sub !== user._id.toString()) {
      throw new UnauthorizedException('Invalid access token');
    }
    if (
      !accessTokenPayload.sessionId ||
      !Types.ObjectId.isValid(accessTokenPayload.sessionId)
    ) {
      throw new UnauthorizedException('Invalid access token');
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
        throw new NotFoundException('User not found');
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
          throw new ForbiddenException('Super admin only');
        }
        if (!Types.ObjectId.isValid(trimmedOtherUserId)) {
          throw new NotFoundException('User not found');
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
      throw new NotFoundException('Session not found');
    }
    const sessionToRevokeId = new Types.ObjectId(input.sessionId);
    const sessionWasRevoked = isSuperAdmin(user)
      ? await this.sessionService.revokeBySessionIdGlobal(sessionToRevokeId)
      : await this.sessionService.revoke(sessionToRevokeId, user._id);
    if (!sessionWasRevoked) {
      throw new NotFoundException('Session not found');
    }
    return { success: true };
  }
}
