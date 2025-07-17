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
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsStrongPassword,
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
  @IsMongoId()
  @IsNotEmpty()
  @Field(() => ID)
  _id: Types.ObjectId;

  @MaxLength(20)
  @MinLength(2)
  @IsString()
  @IsNotEmpty()
  @Prop({ required: true, minlength: 2, maxlength: 20, trim: true })
  firstName: string;

  @MaxLength(20)
  @MinLength(2)
  @IsString()
  @IsNotEmpty()
  @Prop({ required: true, minlength: 2, maxlength: 20, trim: true })
  lastName: string;

  @IsEmail()
  @IsNotEmpty()
  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  email: string;

  @IsString()
  @IsNotEmpty()
  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  username: string;

  @IsPhoneNumber()
  @IsNotEmpty()
  @Prop({ required: true, unique: true, trim: true })
  phone: string;

  @MaxLength(32)
  @MinLength(8)
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  })
  @IsString()
  @IsNotEmpty()
  @Prop({ required: true, minlength: 8, trim: true })
  password: string;

  @IsNotEmpty()
  @Prop({ type: String, enum: Gender })
  gender: Gender;

  @IsOptional()
  @Field(() => ID)
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  @IsOptional()
  @Prop()
  lastActiveAt?: Date;

  @IsNotEmpty()
  @Prop({ type: String, enum: UserStatus, default: UserStatus.PENDING })
  status: UserStatus;

  createdAt: Date;
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
