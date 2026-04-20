import { Module } from '@nestjs/common';
import { ActivityLogResolver } from './activity-logs.resolver';
import { ActivityLogService } from './activity-logs.service';

@Module({
  providers: [ActivityLogService, ActivityLogResolver],
  exports: [ActivityLogService],
})
export class ActivityLogModule {}
