import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

@ObjectType()
@Schema({ timestamps: true })
export class ActivityLog {
  @Prop({ required: true })
  @Field({ description: 'The collection name' })
  collectionName: string;

  @Prop({ required: true })
  @Field({ description: 'The action performed' })
  action: string;

  @Prop({ type: SchemaTypes.ObjectId })
  @Field(() => ID, {
    nullable: true,
    description: 'The user who performed the action',
  })
  user: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId })
  @Field(() => ID, {
    nullable: true,
    description: 'The original document id',
  })
  documentId: Types.ObjectId;

  @Prop({ required: true, type: SchemaTypes.Mixed })
  @Field(() => Object, { description: 'The payload of the request' })
  payload: object;

  @Prop({ required: true, type: SchemaTypes.Mixed })
  @Field(() => Object, {
    description: 'The difference of the previous and updated document',
  })
  changes: object;
}

export type ActivityLogDocument = HydratedDocument<ActivityLog>;
export const ActivityLogSchema = SchemaFactory.createForClass(ActivityLog);
