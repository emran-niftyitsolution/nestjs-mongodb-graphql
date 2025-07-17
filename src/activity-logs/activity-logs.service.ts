import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { detailedDiff } from 'deep-object-diff';
import { Document, Model, Schema, Types } from 'mongoose';
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

  /**
   * Extracts req, user, and body from the current request context.
   */
  private static extractContext() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const ctx = RequestContext.currentContext as
      | { req?: { user?: unknown; body?: unknown } }
      | undefined;
    const req = ctx?.req;
    const user = req?.user ?? null;
    const body = req?.body ?? null;
    return { req, user, body };
  }

  /**
   * Returns the diff between two objects.
   */
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

  /**
   * Creates an activity log entry.
   */
  private static async createLog(
    action: LogActionType,
    collectionName: string,
    documentId: string,
    changes: Record<string, unknown> | null,
    payloadVars: Record<string, unknown> | null,
    body: Record<string, unknown> | null,
    user: { _id?: string | Types.ObjectId } | null,
  ) {
    if (collectionName === 'activitylogs') return;
    let payloadValue: Record<string, unknown> = {};
    if (payloadVars && typeof payloadVars === 'object') {
      payloadValue = payloadVars;
    } else if (body && typeof body === 'object') {
      payloadValue = body;
    }
    let userId: Types.ObjectId | null = null;
    if (user && typeof user === 'object' && '_id' in user && user._id) {
      if (user._id instanceof Types.ObjectId) {
        userId = user._id;
      } else if (
        typeof user._id === 'string' &&
        Types.ObjectId.isValid(user._id)
      ) {
        userId = new Types.ObjectId(user._id);
      }
    }
    const payload = {
      collectionName,
      action,
      user: userId,
      documentId: documentId ?? null,
      payload: payloadValue,
      changes: changes ?? null,
    };
    await this.activityLogModel.create(payload);
  }

  /**
   * Mongoose plugin: attaches hooks for logging create, update, and delete actions.
   */
  static apply(this: void, schema: Schema<Document>) {
    function safeUpdate(update: unknown): Record<string, unknown> {
      if (!update || typeof update !== 'object' || Array.isArray(update))
        return {};
      return update as Record<string, unknown>;
    }
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
    // Post hooks: log changes (fire-and-forget)
    function postHook(action: LogActionType) {
      return function (doc: Document, next: () => void) {
        next();
        void ActivityLogService.postSchema(action, {}, doc, () => {});
      };
    }
    schema.post('save', postHook(LogActionType.CREATE));
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
    schema.post('deleteOne', postHook(LogActionType.DELETE));
    schema.post('findOneAndDelete', postHook(LogActionType.DELETE));
  }

  /**
   * Pre-hook: gathers previous data for diffing.
   */
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

  /**
   * Post-hook: logs after operation (used by post hooks).
   */
  private static async postSchema(
    action: LogActionType,
    updatedObject: Record<string, unknown>,
    doc: unknown,
    next: () => void,
  ) {
    if (!doc || typeof doc !== 'object') return next();
    const { user, body } = this.extractContext();
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
      if (Object.keys(before).length) {
        changes = this.getChanges(before, after);
      } else {
        // If no before, just show updated
        changes = { updated: after };
      }
      // Rename $setOnInsert to before and $set to after in the 'updated' property if present
      if (
        changes.updated &&
        typeof changes.updated === 'object' &&
        changes.updated !== null
      ) {
        const updated = changes.updated as Record<string, unknown>;
        const renamed: Record<string, unknown> = {};
        if ('$setOnInsert' in updated) {
          renamed.before = updated['$setOnInsert'];
          delete updated['$setOnInsert'];
        }
        if ('$set' in updated) {
          renamed.after = updated['$set'];
          delete updated['$set'];
        }
        // Copy any other properties
        for (const key of Object.keys(updated)) {
          if (key !== 'before' && key !== 'after') {
            renamed[key] = updated[key];
          }
        }
        changes.updated = renamed;
      }
    } else if (action === LogActionType.DELETE) {
      changes['deleted'] = JSON.parse(JSON.stringify(doc));
    }
    let payloadVars: Record<string, unknown> | null = null;
    if (
      body &&
      typeof body === 'object' &&
      'variables' in body &&
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      typeof (body as any).variables === 'object' &&
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      (body as any).variables !== null
    ) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      payloadVars = { ...(body as any).variables } as Record<string, unknown>;
      for (const key of Object.keys(payloadVars)) {
        if (key === 'refreshTokenInput') return next();
        const val = payloadVars[key] as Record<string, unknown>;
        if (val && typeof val === 'object' && 'password' in val) {
          val.password = '*****';
        }
      }
    }
    let collectionName = '';
    let documentId = '';
    if (
      'collection' in doc &&
      doc.collection &&
      typeof doc.collection === 'object' &&
      'name' in doc.collection
    ) {
      collectionName = (doc.collection as { name?: string }).name ?? '';
    } else if ('collectionName' in doc) {
      collectionName =
        (doc as { collectionName?: string }).collectionName ?? '';
    }
    if ('_id' in doc) {
      documentId = (doc as { _id?: string })._id ?? '';
    }
    if (changes && Object.keys(changes).length) {
      await this.createLog(
        action,
        collectionName,
        documentId,
        changes,
        payloadVars ?? null,
        body && typeof body === 'object'
          ? (body as Record<string, unknown>)
          : ({} as Record<string, unknown>),
        user ?? null,
      );
    }
    next();
  }
}
