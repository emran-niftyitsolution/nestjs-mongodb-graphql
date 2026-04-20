import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { users } from './user.schema';

export const activityLogs = pgTable(
  'activity_logs',
  {
    id: serial('id').primaryKey(),
    collectionName: text('collection_name').notNull(),
    action: text('action').notNull(),
    userId: integer('user_id').references(() => users.id),
    documentId: text('document_id'),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    changes: jsonb('changes').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('activity_logs_id_idx').on(table.id),
    index('activity_logs_collection_name_idx').on(table.collectionName),
    index('activity_logs_user_id_idx').on(table.userId),
    index('activity_logs_document_id_idx').on(table.documentId),
  ],
);
