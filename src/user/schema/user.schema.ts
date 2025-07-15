import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
}

registerEnumType(Gender, {
  name: 'Gender',
});

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  BANNED = 'BANNED',
  DELETED = 'DELETED',
  PENDING = 'PENDING',
}

registerEnumType(UserStatus, {
  name: 'UserStatus',
});

@ObjectType()
@Schema({
  timestamps: true,
})
export class User {
  @Field(() => ID)
  _id: Types.ObjectId;

  @Field(() => String)
  @Prop({ required: true, minlength: 2, maxlength: 20, trim: true })
  firstName: string;

  @Field(() => String)
  @Prop({ required: true, minlength: 2, maxlength: 20, trim: true })
  lastName: string;

  @Field(() => String)
  @Prop({ required: true, unique: true, trim: true })
  email: string;

  @Field(() => String)
  @Prop({ required: true, unique: true, trim: true })
  username: string;

  @Field(() => String)
  @Prop({ required: true, unique: true, trim: true })
  phone: string;

  @Field(() => String)
  @Prop({ required: true, minlength: 8, maxlength: 20, trim: true })
  password: string;

  @Field(() => String, { nullable: true })
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: false })
  createdBy?: Types.ObjectId;

  @Field(() => Date, { nullable: true })
  @Prop({ required: false })
  lastActiveAt?: Date;

  @Field(() => Gender)
  @Prop({ type: String, enum: Gender })
  gender: Gender;

  @Field(() => UserStatus)
  @Prop({ type: String, enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
