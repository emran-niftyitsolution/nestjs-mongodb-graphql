import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { detailedDiff } from 'deep-object-diff';
import { Document, Model, Schema } from 'mongoose';
import { RequestContext } from 'nestjs-request-context';
import {
  ActivityLog,
  ActivityLogDocument,
} from './schemas/activity-logs.schema';

export enum LogActionType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

@Injectable()
export class ActivityLogService {
  private static activityLogModel: Model<ActivityLogDocument>;

  constructor(
    @InjectModel(ActivityLog.name)
    activityLogModel: Model<ActivityLogDocument>,
  ) {
    ActivityLogService.activityLogModel = activityLogModel;
  }

  // Helper: Safely extract context, body, and user
  private static extractContext() {
    let ctx: unknown = undefined;
    try {
      if (
        typeof RequestContext === 'object' &&
        RequestContext !== null &&
        'currentContext' in RequestContext
      ) {
        ctx = (RequestContext as Record<string, unknown>)['currentContext'];
      }
    } catch {
      return { req: null, user: null, body: null };
    }
    if (!ctx || typeof ctx !== 'object' || !('req' in ctx))
      return { req: null, user: null, body: null };
    const req = (ctx as { req?: unknown }).req;
    if (!req || typeof req !== 'object')
      return { req: null, user: null, body: null };
    const body = (req as { body?: unknown }).body as
      | Record<string, unknown>
      | undefined;
    const user = (req as { user?: { _id?: string } }).user;
    return { req, user, body };
  }

  // Helper: Get changes between two objects
  private static getChanges(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ): Record<string, unknown> {
    const diffFn = detailedDiff as unknown;
    if (typeof diffFn === 'function') {
      const diff = (diffFn as (a: any, b: any) => unknown)(before, after);
      if (diff && typeof diff === 'object' && !Array.isArray(diff)) {
        return diff as Record<string, unknown>;
      }
    }
    return {};
  }

  // Main log creation
  private static async createLog(
    action: LogActionType,
    modelName: string,
    documentId: string,
    diffObject: Record<string, unknown> | null,
    payloadVars: Record<string, unknown> | null,
    body: Record<string, unknown> | null,
    user: { _id?: string } | null,
  ) {
    if (modelName === 'activitylogs') return;
    const payload = {
      target: modelName,
      action,
      user: user && typeof user === 'object' && '_id' in user ? user._id : null,
      documentId: documentId ?? null,
      payload: payloadVars ? payloadVars : body ? body : null,
      changes: diffObject ?? null,
    };
    await this.activityLogModel.create(payload);
  }

  // Plugin-compatible static apply method
  static apply(this: void, schema: Schema<Document>) {
    // Helper: Only pass plain objects to preSchema/postSchema
    function safeUpdate(update: unknown): Record<string, unknown> {
      if (!update || typeof update !== 'object' || Array.isArray(update))
        return {};
      return update as Record<string, unknown>;
    }

    // Pre hooks: gather previous data
    schema.pre('updateOne', async function (next) {
      await ActivityLogService.preSchema(
        this.getQuery(),
        safeUpdate(this.getUpdate()),
        this.model,
        next,
      );
    });
    schema.pre('findOneAndUpdate', async function (next) {
      await ActivityLogService.preSchema(
        this.getQuery(),
        safeUpdate(this.getUpdate()),
        this.model,
        next,
      );
    });
    schema.pre('replaceOne', async function (next) {
      await ActivityLogService.preSchema(
        this.getQuery(),
        safeUpdate(this.getUpdate()),
        this.model,
        next,
      );
    });
    schema.pre('findOneAndReplace', async function (next) {
      await ActivityLogService.preSchema(
        this.getQuery(),
        safeUpdate(this.getUpdate()),
        this.model,
        next,
      );
    });

    // Post hooks: log changes (fire-and-forget, do not await logging)
    schema.post('save', function (doc: Document, next) {
      next();
      void ActivityLogService.postSchema(
        LogActionType.CREATE,
        {},
        doc,
        () => {},
      );
    });
    schema.post('updateOne', function (doc: Document, next) {
      next();
      void ActivityLogService.postSchema(
        LogActionType.UPDATE,
        safeUpdate(this.getUpdate()),
        doc,
        () => {},
      );
    });
    schema.post('findOneAndUpdate', function (doc: Document, next) {
      next();
      void ActivityLogService.postSchema(
        LogActionType.UPDATE,
        safeUpdate(this.getUpdate()),
        doc,
        () => {},
      );
    });
    schema.post('replaceOne', function (doc: Document, next) {
      next();
      void ActivityLogService.postSchema(
        LogActionType.UPDATE,
        safeUpdate(this.getUpdate()),
        doc,
        () => {},
      );
    });
    schema.post('findOneAndReplace', function (doc: Document, next) {
      next();
      void ActivityLogService.postSchema(
        LogActionType.UPDATE,
        safeUpdate(this.getUpdate()),
        doc,
        () => {},
      );
    });
    schema.post('deleteOne', function (doc: Document, next) {
      next();
      void ActivityLogService.postSchema(
        LogActionType.DELETE,
        {},
        doc,
        () => {},
      );
    });
    schema.post('findOneAndDelete', function (doc: Document, next) {
      next();
      void ActivityLogService.postSchema(
        LogActionType.DELETE,
        {},
        doc,
        () => {},
      );
    });
  }

  // Gather previous data for diffing (used by pre hooks)
  private static async preSchema(
    query: Record<string, unknown>,
    updatedObject: Record<string, unknown>,
    model: Model<any>,
    next: () => void,
  ) {
    const keys = Object.keys(updatedObject).filter(
      (key) => !key.startsWith('$'),
    );
    if (!keys.includes('updatedAt')) keys.push('updatedAt');
    const result = await model.findOne(query).select(keys).lean();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (this as any)._previousData = Array.isArray(result)
      ? result[0] || {}
      : result || {};
    next();
  }

  // Log after operation (used by post hooks)
  private static async postSchema(
    action: LogActionType,
    updatedObject: Record<string, unknown>,
    doc: unknown,
    next: () => void,
  ) {
    if (!doc || typeof doc !== 'object') return next();
    // Extract context, user, body
    const { user, body } = this.extractContext();
    // Helper to safely get _previousData from this
    function getPreviousData(ctx: unknown): Record<string, unknown> {
      if (
        ctx &&
        typeof ctx === 'object' &&
        Object.prototype.hasOwnProperty.call(ctx, '_previousData')
      ) {
        const val = (ctx as { _previousData?: unknown })._previousData;
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          return val as Record<string, unknown>;
        }
      }
      return {};
    }
    // Get previous data from preSchema
    const previousData = getPreviousData(this);
    let changes: Record<string, unknown> = {};
    if (action === LogActionType.CREATE) {
      changes['added'] = JSON.parse(JSON.stringify(doc));
    } else if (action === LogActionType.UPDATE) {
      const beforeRawVal = previousData
        ? (JSON.parse(JSON.stringify(previousData)) as unknown)
        : {};
      const afterRawVal = updatedObject
        ? (JSON.parse(JSON.stringify(updatedObject)) as unknown)
        : {};
      const before =
        beforeRawVal &&
        typeof beforeRawVal === 'object' &&
        !Array.isArray(beforeRawVal)
          ? (beforeRawVal as Record<string, unknown>)
          : ({} as Record<string, unknown>);
      const after =
        afterRawVal &&
        typeof afterRawVal === 'object' &&
        !Array.isArray(afterRawVal)
          ? (afterRawVal as Record<string, unknown>)
          : ({} as Record<string, unknown>);
      changes = Object.keys(before).length
        ? this.getChanges(before, after)
        : { updated: after };
    } else if (action === LogActionType.DELETE) {
      changes['deleted'] = JSON.parse(JSON.stringify(doc));
    }
    // Mask sensitive fields in payload
    let payloadVars: Record<string, unknown> | null = null;
    if (
      body &&
      'variables' in body &&
      typeof body.variables === 'object' &&
      body.variables !== null
    ) {
      payloadVars = { ...body.variables } as Record<string, unknown>;
      for (const key of Object.keys(payloadVars)) {
        if (key === 'refreshTokenInput') return next();
        const val = payloadVars[key] as Record<string, unknown>;
        if (val && typeof val === 'object' && 'password' in val) {
          val.password = '*****';
        }
      }
    }
    // Get model name and document id
    let modelName = '';
    let documentId = '';
    if (
      'collection' in doc &&
      doc.collection &&
      typeof doc.collection === 'object' &&
      'name' in doc.collection
    ) {
      modelName = (doc.collection as { name?: string }).name ?? '';
    } else if ('target' in doc) {
      modelName = (doc as { target?: string }).target ?? '';
    }
    if ('_id' in doc) {
      documentId = (doc as { _id?: string })._id ?? '';
    }
    if (changes && Object.keys(changes).length) {
      await this.createLog(
        action,
        modelName,
        documentId,
        changes,
        payloadVars ?? null,
        body ?? null,
        user ?? null,
      );
    }
    next();
  }
}
