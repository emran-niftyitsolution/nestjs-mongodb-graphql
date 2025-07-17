import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { detailedDiff, DetailedDiff } from 'deep-object-diff';
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

interface IRequestContext {
  body?: any;
  user?: { _id?: string };
}

@Injectable()
export class ActivityLogService {
  static activityLogModel: Model<ActivityLogDocument>;
  static previousData: Record<string, unknown> | undefined;
  static updatedObject: Record<string, unknown> | undefined;

  constructor(
    @InjectModel(ActivityLog.name)
    activityLogModel: Model<ActivityLogDocument>,
  ) {
    ActivityLogService.activityLogModel = activityLogModel;
  }

  static getChanges(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ): DetailedDiff {
    return detailedDiff(before, after);
  }

  static async createLog(
    action: LogActionType,
    modelName: string,
    documentId: string,
    diffObject: unknown,
  ) {
    const req = RequestContext.currentContext.req as IRequestContext;
    const body = (req?.body ?? {}) as Record<string, unknown>;
    const user = req?.user as { _id?: string } | undefined;

    if (modelName === 'activitylogs') return;

    let payloadVariables: Record<string, unknown> | undefined;
    if (
      body &&
      typeof body === 'object' &&
      'variables' in body &&
      (body as { variables?: unknown }).variables &&
      typeof (body as { variables?: unknown }).variables === 'object'
    ) {
      const safeVariables = {
        ...(body as { variables: Record<string, unknown> }).variables,
      };
      for (const key of Object.keys(safeVariables)) {
        if (key === 'refreshTokenInput') {
          return;
        }
        const variableValue = safeVariables[key] as Record<string, unknown>;
        if (
          variableValue &&
          typeof variableValue === 'object' &&
          'password' in variableValue
        ) {
          (variableValue as { password?: string }).password = '*****';
        }
      }
      payloadVariables = safeVariables;
    }

    const payload = {
      collectionName: modelName,
      action: action,
      user: user?._id ?? null,
      documentId: documentId ?? null,
      payload: payloadVariables
        ? payloadVariables
        : Object.keys(body).length
          ? body
          : null,
      changes: diffObject ?? null,
    };

    if (modelName) {
      await this.activityLogModel.create(payload);
    }
  }

  static async preSchema(
    query: Record<string, unknown>,
    updatedObject: Record<string, unknown>,
    model: Model<any>,
    next: () => void,
  ) {
    const keys = Object.keys(updatedObject ?? {}).filter(
      (key) => !key.startsWith('$'),
    );

    if (!keys.includes('updatedAt')) {
      keys.push('updatedAt');
    }

    if (model && typeof model.findOne === 'function') {
      const found = await model.findOne(query).select(keys).lean();
      ActivityLogService.previousData =
        found && typeof found === 'object' && !Array.isArray(found)
          ? (found as Record<string, unknown>)
          : undefined;
    } else {
      ActivityLogService.previousData = undefined;
    }

    next();
  }

  static async postSchema(
    action: LogActionType,
    updatedObject: unknown,
    doc: unknown,
    next: () => void,
  ) {
    if (!doc) {
      next();
      return;
    }

    let changes: {
      before: Record<string, unknown>;
      after: Record<string, unknown>;
    } = {
      before: {},
      after: {},
    };

    if (action === LogActionType.CREATE) {
      const docObj = JSON.parse(JSON.stringify(doc)) as Record<string, unknown>;
      changes = { before: docObj, after: docObj };
    }

    if (action === LogActionType.UPDATE) {
      let safeSet: Record<string, unknown> = {};
      if (
        updatedObject &&
        typeof updatedObject === 'object' &&
        '$set' in (updatedObject as Record<string, unknown>) &&
        (updatedObject as Record<string, unknown>)['$set'] &&
        typeof (updatedObject as Record<string, unknown>)['$set'] === 'object'
      ) {
        safeSet = (updatedObject as Record<string, { [key: string]: unknown }>)[
          '$set'
        ] as Record<string, unknown>;
      }
      ActivityLogService.updatedObject = safeSet;

      const before = ActivityLogService.previousData
        ? (JSON.parse(
            JSON.stringify(ActivityLogService.previousData),
          ) as Record<string, unknown>)
        : {};
      const after = safeSet
        ? (JSON.parse(JSON.stringify(safeSet)) as Record<string, unknown>)
        : {};

      // Only include changed fields in before/after
      const diff = ActivityLogService.getChanges(before, after);
      const changedKeys = [
        ...Object.keys(diff.added || {}),
        ...Object.keys(diff.updated || {}),
        ...Object.keys(diff.deleted || {}),
      ];
      const beforeFiltered: Record<string, unknown> = {};
      const afterFiltered: Record<string, unknown> = {};
      for (const key of changedKeys) {
        if (!(key in after)) continue;
        beforeFiltered[key] = before[key];
        afterFiltered[key] = after[key];
      }
      changes = { before: beforeFiltered, after: afterFiltered };
    }

    if (action === LogActionType.DELETE) {
      const docObj = JSON.parse(JSON.stringify(doc)) as Record<string, unknown>;
      changes = { before: docObj, after: docObj };
    }

    if (changes && Object.keys(changes).length) {
      let collectionName = '';
      if (
        doc &&
        typeof doc === 'object' &&
        'collection' in (doc as Record<string, unknown>) &&
        (doc as Record<string, unknown>).collection &&
        typeof (doc as Record<string, unknown>).collection === 'object' &&
        'name' in (doc as { collection?: { name?: string } }).collection!
      ) {
        collectionName =
          (
            (doc as { collection?: { name?: string } }).collection as {
              name?: string;
            }
          ).name || '';
      } else if (
        doc &&
        typeof doc === 'object' &&
        'collectionName' in (doc as Record<string, unknown>)
      ) {
        collectionName =
          (doc as { collectionName?: string }).collectionName || '';
      }
      const docId =
        doc &&
        typeof doc === 'object' &&
        '_id' in (doc as Record<string, unknown>)
          ? (doc as { _id?: string })._id || ''
          : '';
      await ActivityLogService.createLog(
        action,
        collectionName,
        docId,
        changes,
      );
    }

    next();
  }

  static apply(schema: Schema<Document>) {
    // schema.pre
    schema.pre('save', async function (next) {
      ActivityLogService.updatedObject = this.isNew ? {} : this.getChanges();
      await Promise.resolve(); // ensure at least one await for async
      next();
    });

    schema.pre('updateOne', async function (next) {
      const query = this.getQuery();
      const update = this.getUpdate();
      const model = this.model;
      await ActivityLogService.preSchema(
        query,
        update && typeof update === 'object' && !Array.isArray(update)
          ? update
          : {},
        model,
        next,
      );
    });

    schema.pre('findOneAndUpdate', async function (next) {
      const query = this.getQuery();
      const update = this.getUpdate();
      const model = this.model;
      await ActivityLogService.preSchema(
        query,
        update && typeof update === 'object' && !Array.isArray(update)
          ? update
          : {},
        model,
        next,
      );
    });

    schema.pre('replaceOne', async function (next) {
      const query = this.getQuery();
      const update = this.getUpdate();
      const model = this.model;
      await ActivityLogService.preSchema(
        query,
        update && typeof update === 'object' && !Array.isArray(update)
          ? update
          : {},
        model,
        next,
      );
    });

    schema.pre('findOneAndReplace', async function (next) {
      const query = this.getQuery();
      const update = this.getUpdate();
      const model = this.model;
      await ActivityLogService.preSchema(
        query,
        update && typeof update === 'object' && !Array.isArray(update)
          ? update
          : {},
        model,
        next,
      );
    });

    // schema post
    schema.post('save', async function (doc: Document, next) {
      const updatedObj = ActivityLogService.updatedObject ?? {};
      await ActivityLogService.postSchema(
        !Object.keys(updatedObj).length
          ? LogActionType.CREATE
          : LogActionType.UPDATE,
        !Object.keys(updatedObj).length ? null : updatedObj,
        doc,
        next,
      );
    });

    schema.post('updateOne', async function (doc: Document, next) {
      await ActivityLogService.postSchema(
        LogActionType.UPDATE,
        this.getUpdate(),
        doc,
        next,
      );
    });

    schema.post('findOneAndUpdate', async function (doc: Document, next) {
      await ActivityLogService.postSchema(
        LogActionType.UPDATE,
        this.getUpdate(),
        doc,
        next,
      );
    });

    schema.post('replaceOne', async function (doc: Document, next) {
      await ActivityLogService.postSchema(
        LogActionType.UPDATE,
        this.getUpdate(),
        doc,
        next,
      );
    });

    schema.post('findOneAndReplace', async function (doc: Document, next) {
      await ActivityLogService.postSchema(
        LogActionType.UPDATE,
        this.getUpdate(),
        doc,
        next,
      );
    });

    schema.post('deleteOne', async function (doc: Document, next) {
      await ActivityLogService.postSchema(
        LogActionType.DELETE,
        null,
        doc,
        next,
      );
    });

    schema.post('findOneAndDelete', async function (doc: Document, next) {
      await ActivityLogService.postSchema(
        LogActionType.DELETE,
        null,
        doc,
        next,
      );
    });
  }
}
