import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as argon2 from 'argon2';
import { type Model, type Types } from 'mongoose';
import type { SessionClientMeta } from './interfaces/session-client-meta.interface';
import {
  UserSession,
  type UserSessionDocument,
} from './schemas/user-session.schema';

@Injectable()
export class SessionService {
  constructor(
    @InjectModel(UserSession.name)
    private readonly sessionModel: Model<UserSessionDocument>,
  ) {}

  async createForLogin(
    sessionId: Types.ObjectId,
    userId: Types.ObjectId,
    refreshToken: string,
    sessionMeta?: SessionClientMeta,
  ): Promise<void> {
    const hashedRefreshToken = await argon2.hash(refreshToken);
    await this.sessionModel.create({
      _id: sessionId,
      userId,
      refreshTokenHash: hashedRefreshToken,
      lastActiveAt: new Date(),
      userAgent: sessionMeta?.userAgent,
      ipAddress: sessionMeta?.ipAddress,
      deviceName: sessionMeta?.deviceName,
    });
  }

  async isActive(
    sessionId: Types.ObjectId,
    userId: Types.ObjectId,
  ): Promise<boolean> {
    const activeSessionCount = await this.sessionModel.countDocuments({
      _id: sessionId,
      userId,
      revokedAt: null,
    });
    return activeSessionCount > 0;
  }

  async setRefreshTokenHash(
    sessionId: Types.ObjectId,
    userId: Types.ObjectId,
    newRefreshToken: string,
  ): Promise<boolean> {
    const newHashedRefreshToken = await argon2.hash(newRefreshToken);
    const updateResult = await this.sessionModel.updateOne(
      { _id: sessionId, userId, revokedAt: null },
      {
        $set: {
          refreshTokenHash: newHashedRefreshToken,
          lastActiveAt: new Date(),
        },
      },
    );
    return updateResult.matchedCount > 0;
  }

  async getActiveById(
    sessionId: Types.ObjectId,
    userId: Types.ObjectId,
  ): Promise<Pick<
    UserSessionDocument,
    '_id' | 'userId' | 'revokedAt' | 'refreshTokenHash'
  > | null> {
    return this.sessionModel
      .findOne({ _id: sessionId, userId, revokedAt: null })
      .select('+refreshTokenHash')
      .exec();
  }

  async listActiveForUser(userId: Types.ObjectId): Promise<UserSession[]> {
    const activeSessionDocuments = await this.sessionModel
      .find({ userId, revokedAt: null })
      .select('-refreshTokenHash')
      .sort({ lastActiveAt: -1 })
      .lean()
      .exec();
    return activeSessionDocuments as UserSession[];
  }

  async revoke(
    sessionId: Types.ObjectId,
    userId: Types.ObjectId,
  ): Promise<boolean> {
    const result = await this.sessionModel.updateOne(
      { _id: sessionId, userId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
    return result.matchedCount > 0;
  }

  /**
   * Revoke a session by id regardless of user (e.g. super admin).
   * Returns true if a session was matched and updated.
   */
  async revokeBySessionIdGlobal(sessionId: Types.ObjectId): Promise<boolean> {
    const globalRevokeResult = await this.sessionModel.updateOne(
      { _id: sessionId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
    return globalRevokeResult.matchedCount > 0;
  }

  async revokeAllForUser(userId: Types.ObjectId): Promise<void> {
    await this.sessionModel.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  }
}
