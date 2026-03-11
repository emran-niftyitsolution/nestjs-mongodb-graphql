import { Args, Query, Resolver } from '@nestjs/graphql';
import {
  ActivityLogPaginateFilterInput,
  PaginatedActivityLog,
} from './dto/activity-log.input';
import { ActivityLog } from './schemas/activity-logs.schema';
import { ActivityLogService } from './activity-logs.service';

@Resolver(() => ActivityLog)
export class ActivityLogResolver {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @Query(() => PaginatedActivityLog, { name: 'paginateActivityLogs' })
  paginateActivityLogs(
    @Args('filter', { nullable: true }) filter?: ActivityLogPaginateFilterInput,
  ) {
    return this.activityLogService.paginateActivityLogs(filter);
  }

  @Query(() => [String], { name: 'getDistinctTargets' })
  getDistinctTargets(): Promise<string[]> {
    return this.activityLogService.getDistinctTargets();
  }
}
