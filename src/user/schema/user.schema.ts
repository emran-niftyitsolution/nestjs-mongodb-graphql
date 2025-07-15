import {
  Field,
  ID,
  InputType,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
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

@InputType('UserInput')
@ObjectType()
@Schema({
  timestamps: true,
})
export class User {
  @Field(() => ID)
  _id: Types.ObjectId;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(20)
  @Field(() => String)
  @Prop({ required: true, minlength: 2, maxlength: 20, trim: true })
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(20)
  @Field(() => String)
  @Prop({ required: true, minlength: 2, maxlength: 20, trim: true })
  lastName: string;

  @IsString()
  @IsNotEmpty()
  @IsEmail()
  @Field(() => String)
  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  email: string;

  @IsString()
  @IsNotEmpty()
  @Field(() => String)
  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  username: string;

  @IsString()
  @IsNotEmpty()
  @Field(() => String)
  @Prop({ required: true, unique: true, trim: true })
  phone: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(20)
  @Field(() => String)
  @Prop({ required: true, minlength: 8, maxlength: 20, trim: true })
  password: string;

  @IsNotEmpty()
  @Field(() => Gender)
  @Prop({ type: String, enum: Gender })
  gender: Gender;

  @IsOptional()
  @Field(() => String, { nullable: true })
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: false })
  createdBy?: Types.ObjectId;

  @IsOptional()
  @Field(() => Date, { nullable: true })
  @Prop({ required: false })
  lastActiveAt?: Date;

  @IsNotEmpty()
  @Field(() => UserStatus)
  @Prop({ type: String, enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
