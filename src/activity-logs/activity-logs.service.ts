import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
  SQL,
} from 'drizzle-orm';
import { RequestContext } from 'nestjs-request-context';
import { DRIZZLE } from '../database/drizzle.module';
import { activityLogs, users } from '../database/schema';
import { DrizzleDB } from '../database/types/drizzle';
import {
  ActivityLogPaginateFilterInput,
  LogActionType,
} from './dto/activity-log.input';
import { ActivityLog } from './schemas/activity-logs.schema';

export { LogActionType };

interface IRequestContext {
  body?: Record<string, unknown>;
  user?: { _id?: number };
}

interface ILogPayload {
  collectionName: string;
  action: LogActionType;
  user: number | null;
  documentId: string | null;
  payload: Record<string, unknown>;
  changes: Record<string, unknown>;
}

@Injectable()
export class ActivityLogService {
  private readonly logger = new Logger(ActivityLogService.name);
  private readonly EXCLUDED_COLLECTIONS = new Set(['activitylogs']);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  private getRequestContext(): IRequestContext {
    try {
      return (RequestContext.currentContext?.req as IRequestContext) ?? {};
    } catch {
      return {};
    }
  }

  private sanitizePayload(
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    const sanitized = { ...payload };

    if (
      sanitized.variables &&
      typeof sanitized.variables === 'object' &&
      sanitized.variables !== null
    ) {
      const variables = sanitized.variables as Record<string, unknown>;

      if (variables.refreshTokenInput) {
        return {};
      }

      for (const value of Object.values(variables)) {
        if (value && typeof value === 'object' && value !== null) {
          const objValue = value as Record<string, unknown>;
          if ('password' in objValue) {
            objValue.password = '*****';
          }
        }
      }

      sanitized.variables = variables;
    }

    return sanitized;
  }

  private parseUserId(id?: number): number | null {
    if (id === undefined || id === null) return null;

    const parsed = Number(id);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  async createLog(
    action: LogActionType,
    modelName: string,
    documentId: string,
    diffObject: unknown,
  ): Promise<void> {
    if (this.EXCLUDED_COLLECTIONS.has(modelName.toLowerCase())) {
      return;
    }

    const req = this.getRequestContext();
    const body = req?.body ?? {};
    const user = req?.user;

    if (
      body?.variables &&
      typeof body.variables === 'object' &&
      (body.variables as Record<string, unknown>).refreshTokenInput != null
    ) {
      return;
    }

    const sanitizedPayload = this.sanitizePayload(body);
    const payload: ILogPayload = {
      collectionName: modelName,
      action,
      user: this.parseUserId(user?._id),
      documentId: documentId || null,
      payload: Object.keys(sanitizedPayload).length > 0 ? sanitizedPayload : {},
      changes: (diffObject as Record<string, unknown>) ?? {},
    };

    try {
      await this.db.insert(activityLogs).values({
        collectionName: payload.collectionName,
        action: payload.action,
        userId: payload.user,
        documentId: payload.documentId,
        payload: payload.payload,
        changes: payload.changes,
      });
    } catch (error) {
      this.logger.error('Failed to create activity log', error);
    }
  }

  async paginateActivityLogs(
    filter: ActivityLogPaginateFilterInput = {},
  ): Promise<{
    docs: ActivityLog[];
    totalDocs: number;
    limit: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
    page?: number;
    totalPages: number;
    prevPage?: number | null;
    nextPage?: number | null;
    pagingCounter: number;
  }> {
    try {
      const conditions: SQL[] = [];

      if (filter.target) {
        conditions.push(
          ilike(activityLogs.collectionName, `%${filter.target}%`),
        );
      }

      if (filter.action) {
        conditions.push(eq(activityLogs.action, filter.action));
      }

      if (filter.search) {
        const searchText = String(filter.search).trim();
        const searchConditions: SQL[] = [
          eq(activityLogs.documentId, searchText),
        ];
        const searchUserId = Number(searchText);

        if (Number.isInteger(searchUserId) && searchUserId > 0) {
          searchConditions.push(eq(activityLogs.userId, searchUserId));
        }

        const matchingUsers = await this.db
          .select({ id: users.id })
          .from(users)
          .where(
            or(
              ilike(users.firstName, `%${searchText}%`),
              ilike(users.lastName, `%${searchText}%`),
              ilike(users.email, `%${searchText}%`),
            ),
          );

        if (matchingUsers.length > 0) {
          searchConditions.push(
            inArray(
              activityLogs.userId,
              matchingUsers.map((u) => u.id),
            ),
          );
        }

        conditions.push(or(...searchConditions)!);
      }

      if (filter.startDate) {
        conditions.push(
          gte(activityLogs.createdAt, new Date(filter.startDate)),
        );
      }

      if (filter.endDate) {
        const endDate = new Date(filter.endDate);
        endDate.setHours(23, 59, 59, 999);
        conditions.push(lte(activityLogs.createdAt, endDate));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const page = filter.page ?? 1;
      const limit = filter.limit ?? 10;
      const offset = (page - 1) * limit;
      const sortDirection =
        filter.sortByCreatedAt === 1
          ? asc(activityLogs.createdAt)
          : desc(activityLogs.createdAt);

      const docs = await this.db
        .select()
        .from(activityLogs)
        .where(where)
        .orderBy(sortDirection)
        .limit(limit)
        .offset(offset);

      const [{ count }] = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(activityLogs)
        .where(where);

      const totalDocs = Number(count || 0);
      const totalPages = Math.max(1, Math.ceil(totalDocs / limit));

      return {
        docs: docs.map((doc) => ({
          id: doc.id,
          collectionName: doc.collectionName,
          action: doc.action,
          user: doc.userId,
          documentId: doc.documentId,
          payload: doc.payload,
          changes: doc.changes,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        })),
        totalDocs,
        limit,
        hasPrevPage: page > 1,
        hasNextPage: page < totalPages,
        page,
        totalPages,
        prevPage: page > 1 ? page - 1 : null,
        nextPage: page < totalPages ? page + 1 : null,
        pagingCounter: totalDocs === 0 ? 0 : offset + 1,
      };
    } catch (error) {
      this.logger.error('Error paginating activity logs', error);
      throw error;
    }
  }

  async getDistinctTargets(): Promise<string[]> {
    try {
      const distinctTargets = await this.db
        .selectDistinct({ collectionName: activityLogs.collectionName })
        .from(activityLogs);

      return distinctTargets
        .map((target) => target.collectionName)
        .filter(
          (t): t is string => t != null && typeof t === 'string' && t !== '',
        )
        .sort();
    } catch (error) {
      this.logger.error('Error getting distinct targets', error);
      throw error;
    }
  }
}
