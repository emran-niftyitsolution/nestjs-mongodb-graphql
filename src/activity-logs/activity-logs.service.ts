import { Inject, Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import { detailedDiff, DetailedDiff } from 'deep-object-diff';
import { Document, Model, PaginateModel, Schema, Types } from 'mongoose';
import { RequestContext } from 'nestjs-request-context';
import { ActivityLogPaginateFilterInput } from './dto/activity-log.input';
import { LogActionType } from './dto/activity-log.input';
import {
  ActivityLog,
  ActivityLogDocument,
} from './schemas/activity-logs.schema';
import { User, UserDocument } from '../user/schema/user.schema';

export { LogActionType };

interface IRequestContext {
  body?: Record<string, unknown>;
  user?: { _id?: string };
}

interface ILogPayload {
  collectionName: string;
  action: LogActionType;
  user: string | null;
  documentId: string | null;
  payload: Record<string, unknown> | null;
  changes: Record<string, unknown> | null;
}

interface IChanges {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

@Injectable()
export class ActivityLogService {
  private readonly logger = new Logger(ActivityLogService.name);
  private readonly dataCache = new Map<string, Record<string, unknown>>();
  private readonly EXCLUDED_COLLECTIONS = new Set(['activitylogs']);
  private static instance: ActivityLogService;

  constructor(
    @InjectModel(ActivityLog.name)
    private readonly activityLogModel: Model<ActivityLogDocument> &
      PaginateModel<ActivityLogDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @Inject(ModuleRef) private readonly moduleRef: ModuleRef,
  ) {
    ActivityLogService.instance = this;
  }

  static getInstance(): ActivityLogService {
    if (!ActivityLogService.instance) {
      throw new Error('ActivityLogService not initialized');
    }
    return ActivityLogService.instance;
  }

  private static logHookError(context: string, error: unknown): void {
    try {
      ActivityLogService.instance?.logger?.error(context, error);
    } catch {
      console.error(context, error);
    }
  }

  private getChanges(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ): DetailedDiff {
    return detailedDiff(before, after);
  }

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

    // Handle GraphQL variables
    if (
      sanitized.variables &&
      typeof sanitized.variables === 'object' &&
      sanitized.variables !== null
    ) {
      const variables = sanitized.variables as Record<string, unknown>;

      // Skip logging for refresh token operations
      if (variables.refreshTokenInput) {
        return {};
      }

      // Sanitize sensitive fields
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

  private extractCollectionName(doc: unknown): string {
    if (!doc || typeof doc !== 'object' || doc === null) return '';

    const docObj = doc as Record<string, unknown>;

    // Try collection.name first
    if (
      docObj.collection &&
      typeof docObj.collection === 'object' &&
      docObj.collection !== null
    ) {
      const collection = docObj.collection as { name?: string };
      return collection.name ?? '';
    }

    // Try collectionName property
    if (typeof docObj.collectionName === 'string') {
      return docObj.collectionName;
    }

    return '';
  }

  private extractDocumentId(doc: unknown): string {
    if (!doc || typeof doc !== 'object' || doc === null) return '';
    const docObj = doc as Record<string, unknown>;
    const id = docObj._id;
    if (typeof id === 'string') return id;
    // Handle MongoDB extended JSON
    if (
      id &&
      typeof id === 'object' &&
      id !== null &&
      Object.prototype.hasOwnProperty.call(id, '$oid') &&
      typeof (id as { $oid?: unknown }).$oid === 'string'
    ) {
      return (id as { $oid: string }).$oid;
    }
    // Handle Mongoose ObjectId (has a toString method)
    if (
      id &&
      typeof id === 'object' &&
      typeof (id as { toString: () => string }).toString === 'function'
    ) {
      const str = (id as { toString: () => string }).toString();
      if (str && str !== '[object Object]') return str;
    }
    return '';
  }

  async createLog(
    action: LogActionType,
    modelName: string,
    documentId: string,
    diffObject: unknown,
  ): Promise<void> {
    // Skip excluded collections
    if (this.EXCLUDED_COLLECTIONS.has(modelName.toLowerCase())) {
      return;
    }

    const req = this.getRequestContext();
    const body = req?.body ?? {};
    const user = req?.user;

    const sanitizedPayload = this.sanitizePayload(body);
    // Skip only when it was refresh token (sanitizePayload returns {} and we bail for that case)
    if (
      body?.variables &&
      typeof body.variables === 'object' &&
      (body.variables as Record<string, unknown>).refreshTokenInput != null
    ) {
      return;
    }

    const payload: ILogPayload = {
      collectionName: modelName,
      action,
      user: user?._id ?? null,
      documentId: documentId || null,
      payload: Object.keys(sanitizedPayload).length > 0 ? sanitizedPayload : {},
      changes: (diffObject as Record<string, unknown>) ?? {},
    };

    if (modelName && this.activityLogModel) {
      try {
        await this.activityLogModel.create(payload);
      } catch (error) {
        this.logger.error('Failed to create activity log', error);
      }
    }
  }

  private generateCacheKey(query: Record<string, unknown>): string {
    return JSON.stringify(query);
  }

  async preSchema(
    query: Record<string, unknown>,
    updatedObject: Record<string, unknown>,
    model: Model<any>,
  ): Promise<void> {
    try {
      const keys = Object.keys(updatedObject ?? {}).filter(
        (key) => !key.startsWith('$'),
      );

      if (!keys.includes('updatedAt')) {
        keys.push('updatedAt');
      }

      if (model?.findOne) {
        const found = await model.findOne(query).select(keys).lean().exec();
        const cacheKey = this.generateCacheKey(query);

        if (found && typeof found === 'object' && !Array.isArray(found)) {
          this.dataCache.set(cacheKey, found as Record<string, unknown>);
        } else {
          this.dataCache.delete(cacheKey);
        }
      }
    } catch (error) {
      this.logger.error('Error in preSchema', error);
    }
  }

  async postSchema(
    action: LogActionType,
    updatedObject: unknown,
    doc: unknown,
    query?: Record<string, unknown>,
  ): Promise<void> {
    try {
      if (!doc) {
        return;
      }

      const collectionName = this.extractCollectionName(doc);
      const docId = this.extractDocumentId(doc);

      let changes: IChanges = { before: {}, after: {} };

      switch (action) {
        case LogActionType.CREATE: {
          const docObj = JSON.parse(JSON.stringify(doc)) as Record<
            string,
            unknown
          >;
          changes = { before: {}, after: docObj };
          break;
        }
        case LogActionType.UPDATE:
          changes = this.handleUpdateChanges(updatedObject, query);
          break;
        case LogActionType.DELETE: {
          const deletedObj = JSON.parse(JSON.stringify(doc)) as Record<
            string,
            unknown
          >;
          changes = { before: deletedObj, after: {} };
          break;
        }
      }

      if (this.hasChanges(changes)) {
        await this.createLog(action, collectionName, docId, changes);
      }

      // Clean up cache
      if (query) {
        const cacheKey = this.generateCacheKey(query);
        this.dataCache.delete(cacheKey);
      }
    } catch (error) {
      this.logger.error('Error in postSchema', error);
    }
  }

  private handleUpdateChanges(
    updatedObject: unknown,
    query?: Record<string, unknown>,
  ): IChanges {
    let safeSet: Record<string, unknown> = {};

    if (
      updatedObject &&
      typeof updatedObject === 'object' &&
      updatedObject !== null
    ) {
      const updateObj = updatedObject as Record<string, unknown>;
      if (
        updateObj.$set &&
        typeof updateObj.$set === 'object' &&
        updateObj.$set !== null
      ) {
        safeSet = updateObj.$set as Record<string, unknown>;
      }
    }

    const cacheKey = query ? this.generateCacheKey(query) : '';
    const previousData = cacheKey ? this.dataCache.get(cacheKey) : undefined;

    const before = previousData
      ? (JSON.parse(JSON.stringify(previousData)) as Record<string, unknown>)
      : {};
    const after = safeSet
      ? (JSON.parse(JSON.stringify(safeSet)) as Record<string, unknown>)
      : {};

    // Only include changed fields
    const diff = this.getChanges(before, after);
    const changedKeys = [
      ...Object.keys(diff.added ?? {}),
      ...Object.keys(diff.updated ?? {}),
      ...Object.keys(diff.deleted ?? {}),
    ];

    const SENSITIVE_FIELDS = ['password'];
    const beforeFiltered: Record<string, unknown> = {};
    const afterFiltered: Record<string, unknown> = {};

    for (const key of changedKeys) {
      if (SENSITIVE_FIELDS.includes(key)) {
        beforeFiltered[key] = key in before ? '*****' : undefined;
        afterFiltered[key] = key in after ? '*****' : undefined;
        continue;
      }
      beforeFiltered[key] = before[key];
      afterFiltered[key] = after[key];
    }

    return { before: beforeFiltered, after: afterFiltered };
  }

  private hasChanges(changes: IChanges): boolean {
    return (
      Object.keys(changes.before).length > 0 ||
      Object.keys(changes.after).length > 0
    );
  }

  async paginateActivityLogs(
    filter: ActivityLogPaginateFilterInput = {},
  ): Promise<{
    docs: ActivityLogDocument[];
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
      const query: Record<string, unknown> = {};

      if (filter.target) {
        query.collectionName = {
          $regex: filter.target,
          $options: 'i',
        };
      }

      if (filter.action) {
        query.action = filter.action;
      }

      if (filter.search) {
        const searchText = String(filter.search).trim();
        const searchConditions: Record<string, unknown>[] = [];

        if (Types.ObjectId.isValid(searchText)) {
          searchConditions.push({
            documentId: new Types.ObjectId(searchText),
          });
        }

        const userSearchConditions: Record<string, unknown>[] = [];
        if (Types.ObjectId.isValid(searchText)) {
          userSearchConditions.push({ _id: new Types.ObjectId(searchText) });
        }
        userSearchConditions.push({
          $or: [
            { firstName: { $regex: searchText, $options: 'i' } },
            { lastName: { $regex: searchText, $options: 'i' } },
            { email: { $regex: searchText, $options: 'i' } },
          ],
        });

        const matchingUsers = await this.userModel
          .find({ $or: userSearchConditions })
          .select('_id')
          .lean()
          .exec();

        if (matchingUsers.length > 0) {
          searchConditions.push({
            user: { $in: matchingUsers.map((u) => u._id) },
          });
        }

        if (searchConditions.length > 0) {
          query.$or = searchConditions;
        }
      }

      if (filter.startDate || filter.endDate) {
        query.createdAt = {} as Record<string, unknown>;
        if (filter.startDate) {
          (query.createdAt as Record<string, unknown>).$gte = new Date(
            filter.startDate,
          );
        }
        if (filter.endDate) {
          const endDate = new Date(filter.endDate);
          endDate.setHours(23, 59, 59, 999);
          (query.createdAt as Record<string, unknown>).$lte = endDate;
        }
      }

      const sort: Record<string, 1 | -1> = {};
      if (filter.sortByCreatedAt != null) {
        sort.createdAt = filter.sortByCreatedAt;
      }
      if (Object.keys(sort).length === 0) {
        sort.createdAt = -1;
      }

      const page = filter.page ?? 1;
      const limit = filter.limit ?? 10;

      const result = await this.activityLogModel.paginate(query, {
        page,
        limit,
        sort,
        populate: {
          path: 'user',
          select: 'firstName lastName email',
        },
      });

      return result as typeof result & { docs: ActivityLogDocument[] };
    } catch (error) {
      this.logger.error('Error paginating activity logs', error);
      throw error;
    }
  }

  async getDistinctTargets(): Promise<string[]> {
    try {
      const distinctTargets =
        await this.activityLogModel.distinct('collectionName');
      return distinctTargets
        .filter(
          (t): t is string => t != null && typeof t === 'string' && t !== '',
        )
        .sort();
    } catch (error) {
      this.logger.error('Error getting distinct targets', error);
      throw error;
    }
  }

  static apply(this: void, schema: Schema<Document>): void {
    // Pre-save hook
    schema.pre('save', function (next) {
      try {
        const changes = this.isNew ? {} : this.getChanges();
        const cacheKey = this._id?.toString() ?? '';
        if (cacheKey && !this.isNew) {
          const service = ActivityLogService.getInstance();
          service.dataCache.set(cacheKey, changes);
        }
        next();
      } catch (error) {
        ActivityLogService.logHookError('Error in save pre-hook', error);
        next();
      }
    });

    // Pre-update hooks
    schema.pre('updateOne', async function (next) {
      try {
        const query = this.getQuery();
        const update = this.getUpdate();
        const model = this.model;

        const service = ActivityLogService.getInstance();
        await service.preSchema(
          query,
          update &&
            typeof update === 'object' &&
            !Array.isArray(update) &&
            update !== null
            ? update
            : {},
          model,
        );
        next();
      } catch (error) {
        ActivityLogService.logHookError('Error in updateOne pre-hook', error);
        next();
      }
    });

    schema.pre('findOneAndUpdate', async function (next) {
      try {
        const query = this.getQuery();
        const update = this.getUpdate();
        const model = this.model;

        const service = ActivityLogService.getInstance();
        await service.preSchema(
          query,
          update &&
            typeof update === 'object' &&
            !Array.isArray(update) &&
            update !== null
            ? update
            : {},
          model,
        );
        next();
      } catch (error) {
        ActivityLogService.logHookError(
          'Error in findOneAndUpdate pre-hook',
          error,
        );
        next();
      }
    });

    schema.pre('replaceOne', async function (next) {
      try {
        const query = this.getQuery();
        const update = this.getUpdate();
        const model = this.model;

        const service = ActivityLogService.getInstance();
        await service.preSchema(
          query,
          update &&
            typeof update === 'object' &&
            !Array.isArray(update) &&
            update !== null
            ? update
            : {},
          model,
        );
        next();
      } catch (error) {
        ActivityLogService.logHookError('Error in replaceOne pre-hook', error);
        next();
      }
    });

    schema.pre('findOneAndReplace', async function (next) {
      try {
        const query = this.getQuery();
        const update = this.getUpdate();
        const model = this.model;

        const service = ActivityLogService.getInstance();
        await service.preSchema(
          query,
          update &&
            typeof update === 'object' &&
            !Array.isArray(update) &&
            update !== null
            ? update
            : {},
          model,
        );
        next();
      } catch (error) {
        ActivityLogService.logHookError(
          'Error in findOneAndReplace pre-hook',
          error,
        );
        next();
      }
    });

    // Post-save hook
    schema.post('save', async function (doc: Document, next) {
      try {
        const cacheKey = doc._id?.toString() ?? '';

        const service = ActivityLogService.getInstance();
        const cachedChanges = service.dataCache.get(cacheKey);

        await service.postSchema(
          !cachedChanges || Object.keys(cachedChanges).length === 0
            ? LogActionType.CREATE
            : LogActionType.UPDATE,
          cachedChanges ?? null,
          doc,
          undefined,
        );

        // Clean up cache
        if (cacheKey) {
          service.dataCache.delete(cacheKey);
        }
        next();
      } catch (error) {
        ActivityLogService.logHookError('Error in save post-hook', error);
        next();
      }
    });

    // Post-update hooks
    schema.post('updateOne', async function (doc: Document, next) {
      try {
        const service = ActivityLogService.getInstance();
        await service.postSchema(
          LogActionType.UPDATE,
          this.getUpdate(),
          doc,
          this.getQuery(),
        );
        next();
      } catch (error) {
        ActivityLogService.logHookError('Error in updateOne post-hook', error);
        next();
      }
    });

    schema.post('findOneAndUpdate', async function (doc: Document, next) {
      try {
        const service = ActivityLogService.getInstance();
        await service.postSchema(
          LogActionType.UPDATE,
          this.getUpdate(),
          doc,
          this.getQuery(),
        );
        next();
      } catch (error) {
        ActivityLogService.logHookError(
          'Error in findOneAndUpdate post-hook',
          error,
        );
        next();
      }
    });

    schema.post('replaceOne', async function (doc: Document, next) {
      try {
        const service = ActivityLogService.getInstance();
        await service.postSchema(
          LogActionType.UPDATE,
          this.getUpdate(),
          doc,
          this.getQuery(),
        );
        next();
      } catch (error) {
        ActivityLogService.logHookError('Error in replaceOne post-hook', error);
        next();
      }
    });

    schema.post('findOneAndReplace', async function (doc: Document, next) {
      try {
        const service = ActivityLogService.getInstance();
        await service.postSchema(
          LogActionType.UPDATE,
          this.getUpdate(),
          doc,
          this.getQuery(),
        );
        next();
      } catch (error) {
        ActivityLogService.logHookError(
          'Error in findOneAndReplace post-hook',
          error,
        );
        next();
      }
    });

    // Post-delete hooks
    schema.post('deleteOne', async function (doc: Document, next) {
      try {
        const service = ActivityLogService.getInstance();
        await service.postSchema(
          LogActionType.DELETE,
          null,
          doc,
          this.getQuery?.(),
        );
        next();
      } catch (error) {
        ActivityLogService.logHookError('Error in deleteOne post-hook', error);
        next();
      }
    });

    schema.post('findOneAndDelete', async function (doc: Document, next) {
      try {
        const service = ActivityLogService.getInstance();
        await service.postSchema(
          LogActionType.DELETE,
          null,
          doc,
          this.getQuery?.(),
        );
        next();
      } catch (error) {
        ActivityLogService.logHookError(
          'Error in findOneAndDelete post-hook',
          error,
        );
        next();
      }
    });
  }
}
