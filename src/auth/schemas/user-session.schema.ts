import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, SchemaTypes, type Types } from 'mongoose';
import { User } from '../../user/schema/user.schema';

export type UserSessionDocument = HydratedDocument<UserSession>;

@Schema({ collection: 'user_sessions', timestamps: true })
export class UserSession {
  @Prop({ type: SchemaTypes.ObjectId, auto: true })
  _id!: Types.ObjectId;

  @Prop({
    type: SchemaTypes.ObjectId,
    ref: User.name,
    required: true,
    index: true,
  })
  userId!: Types.ObjectId;

  @Prop({ required: true, select: false })
  refreshTokenHash!: string;

  @Prop({ type: Date, required: true, index: true })
  expiresAt!: Date;

  @Prop({ trim: true, maxlength: 200 })
  userAgent?: string;

  @Prop({ trim: true, maxlength: 45 })
  ipAddress?: string;

  @Prop({ trim: true, maxlength: 200 })
  deviceName?: string;

  @Prop()
  lastActiveAt?: Date;

  @Prop({ type: Date, default: null })
  revokedAt?: Date | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const UserSessionSchema = SchemaFactory.createForClass(UserSession);

UserSessionSchema.index(
  { userId: 1, revokedAt: 1, updatedAt: -1 },
  { name: 'userId_revoked_updated' },
);

UserSessionSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: 'ttl_expiresAt' },
);
