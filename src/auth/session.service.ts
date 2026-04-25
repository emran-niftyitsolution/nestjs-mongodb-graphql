import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as argon2 from 'argon2';
import dayjs from 'dayjs';
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
    expiresAt: Date,
    sessionMeta?: SessionClientMeta,
  ): Promise<void> {
    const hashedRefreshToken = await argon2.hash(refreshToken);
    await this.sessionModel.create({
      _id: sessionId,
      userId,
      refreshTokenHash: hashedRefreshToken,
      expiresAt,
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
    const now = new Date();
    const activeSessionExists = await this.sessionModel.exists({
      _id: sessionId,
      userId,
      revokedAt: null,
      expiresAt: { $gt: now },
    });
    return activeSessionExists !== null;
  }

  async setRefreshTokenHash(
    sessionId: Types.ObjectId,
    userId: Types.ObjectId,
    newRefreshToken: string,
    newExpiresAt: Date,
  ): Promise<boolean> {
    const newHashedRefreshToken = await argon2.hash(newRefreshToken);
    const updateResult = await this.sessionModel.updateOne(
      {
        _id: sessionId,
        userId,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      },
      {
        $set: {
          refreshTokenHash: newHashedRefreshToken,
          expiresAt: newExpiresAt,
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
      .findOne({
        _id: sessionId,
        userId,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      })
      .select('+refreshTokenHash')
      .exec();
  }

  async listActiveForUser(userId: Types.ObjectId): Promise<UserSession[]> {
    const now = new Date();
    const activeSessionDocuments = await this.sessionModel
      .find({ userId, revokedAt: null, expiresAt: { $gt: now } })
      .select('-refreshTokenHash')
      .sort({ lastActiveAt: -1 })
      .lean()
      .exec();
    return activeSessionDocuments as UserSession[];
  }

  /**
   * Ensure a user has at most `keep` active sessions by revoking the oldest ones.
   * "Oldest" is based on `lastActiveAt` (fallback `createdAt`).
   */
  async revokeOldestActiveSessionsBeyondLimit(
    userId: Types.ObjectId,
    keep: number,
  ): Promise<void> {
    const limit = Math.max(0, Math.floor(keep));
    if (limit === 0) {
      await this.revokeAllForUser(userId);
      return;
    }

    const now = new Date();
    const sessionsToRevoke = await this.sessionModel
      .find({ userId, revokedAt: null, expiresAt: { $gt: now } })
      .select({ _id: 1 })
      .sort({ lastActiveAt: -1, createdAt: -1 })
      .skip(limit)
      .limit(200)
      .lean()
      .exec();

    if (sessionsToRevoke.length === 0) return;

    const ids = sessionsToRevoke.map((s) => s._id);
    await this.sessionModel.updateMany(
      { _id: { $in: ids }, userId, revokedAt: null },
      { $set: { revokedAt: now, expiresAt: now } },
    );
  }

  /**
   * Update `lastActiveAt` occasionally to avoid write amplification.
   * This is a best-effort update and does not throw if the update doesn't match.
   */
  async touchLastActiveAtIfStale(
    sessionId: Types.ObjectId,
    userId: Types.ObjectId,
    minIntervalMs: number,
  ): Promise<void> {
    const now = dayjs().toDate();
    const cutoff = dayjs(now)
      .subtract(Math.max(0, minIntervalMs), 'millisecond')
      .toDate();
    await this.sessionModel.updateOne(
      {
        _id: sessionId,
        userId,
        revokedAt: null,
        expiresAt: { $gt: now },
        $or: [
          { lastActiveAt: { $lt: cutoff } },
          { lastActiveAt: { $exists: false } },
        ],
      },
      { $set: { lastActiveAt: now } },
    );
  }

  async revoke(
    sessionId: Types.ObjectId,
    userId: Types.ObjectId,
  ): Promise<boolean> {
    const now = new Date();
    const result = await this.sessionModel.updateOne(
      { _id: sessionId, userId, revokedAt: null },
      { $set: { revokedAt: now, expiresAt: now } },
    );
    return result.matchedCount > 0;
  }

  /**
   * Revoke a session by id regardless of user (e.g. super admin).
   * Returns true if a session was matched and updated.
   */
  async revokeBySessionIdGlobal(sessionId: Types.ObjectId): Promise<boolean> {
    const now = new Date();
    const globalRevokeResult = await this.sessionModel.updateOne(
      { _id: sessionId, revokedAt: null },
      { $set: { revokedAt: now, expiresAt: now } },
    );
    return globalRevokeResult.matchedCount > 0;
  }

  async revokeAllForUser(userId: Types.ObjectId): Promise<void> {
    const now = new Date();
    await this.sessionModel.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: now, expiresAt: now } },
    );
  }
}
