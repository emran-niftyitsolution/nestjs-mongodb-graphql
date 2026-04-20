import {
  index,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const genderEnum = pgEnum('gender', ['MALE', 'FEMALE']);
export const userRoleEnum = pgEnum('user_role', [
  'SUPER_ADMIN',
  'ADMIN',
  'USER',
]);
export const userStatusEnum = pgEnum('user_status', [
  'ACTIVE',
  'INACTIVE',
  'BANNED',
  'DELETED',
  'PENDING',
]);

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    email: text('email').notNull(),
    username: text('username'),
    phone: text('phone'),
    password: text('password').notNull(),
    gender: genderEnum('gender'),
    role: userRoleEnum('role').default('USER').notNull(),
    createdBy: text('created_by'),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
    status: userStatusEnum('status').default('PENDING').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('users_id_idx').on(table.id),
    uniqueIndex('users_email_unique').on(table.email),
    uniqueIndex('users_username_unique').on(table.username),
    uniqueIndex('users_phone_unique').on(table.phone),
  ],
);
