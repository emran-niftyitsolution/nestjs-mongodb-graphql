import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../user/schema/user.schema';
import { ActivityLogResolver } from './activity-logs.resolver';
import { ActivityLogService } from './activity-logs.service';
import { ActivityLog, ActivityLogSchema } from './schemas/activity-logs.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ActivityLog.name, schema: ActivityLogSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [ActivityLogService, ActivityLogResolver],
  exports: [ActivityLogService],
})
export class ActivityLogModule {}
