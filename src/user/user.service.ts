import { Inject, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { and, eq, ilike, or, sql, SQL } from 'drizzle-orm';
import { DRIZZLE } from '../database/drizzle.module';
import { users } from '../database/schema';
import { DrizzleDB } from '../database/types/drizzle';
import {
  CreateUserInput,
  PaginatedUser,
  PaginateUserInput,
  UpdateUserInput,
} from './dtos/user.input';
import { Gender, User, UserRole, UserStatus } from './schema/user.schema';

type UserFilter = Partial<User>;

@Injectable()
export class UserService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  private toUserIdNumber(id: number | undefined): number | null {
    if (id === undefined || id === null) return null;

    const parsed = Number(id);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  private mapDbUserToGraphqlUser(row: typeof users.$inferSelect): User {
    return {
      _id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      username: row.username ?? undefined,
      phone: row.phone ?? undefined,
      password: row.password,
      gender: row.gender as Gender | undefined,
      role: row.role as UserRole,
      createdBy: row.createdBy ?? undefined,
      lastActiveAt: row.lastActiveAt ?? undefined,
      status: row.status as UserStatus,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private getFilterConditions(input: {
    _id?: number;
    firstName?: string;
    lastName?: string;
    email?: string;
    username?: string;
    phone?: string;
    gender?: Gender;
    status?: UserStatus;
    role?: UserRole;
    search?: string;
  }): SQL[] {
    const conditions: SQL[] = [];
    const id = this.toUserIdNumber(input._id);

    if (id !== null) conditions.push(eq(users.id, id));
    if (input.firstName) conditions.push(eq(users.firstName, input.firstName));
    if (input.lastName) conditions.push(eq(users.lastName, input.lastName));
    if (input.email) conditions.push(eq(users.email, input.email));
    if (input.username) conditions.push(eq(users.username, input.username));
    if (input.phone) conditions.push(eq(users.phone, input.phone));
    if (input.gender) conditions.push(eq(users.gender, input.gender));
    if (input.status) conditions.push(eq(users.status, input.status));
    if (input.role) conditions.push(eq(users.role, input.role));

    if (input.search) {
      conditions.push(
        or(
          ilike(users.firstName, `%${input.search}%`),
          ilike(users.lastName, `%${input.search}%`),
          ilike(users.email, `%${input.search}%`),
          ilike(users.username, `%${input.search}%`),
          ilike(users.phone, `%${input.search}%`),
        )!,
      );
    }

    return conditions;
  }

  queryBuilder(user: UserFilter) {
    return this.getFilterConditions(user);
  }

  async create(input: CreateUserInput): Promise<User> {
    const hashedPassword = await argon2.hash(input.password);

    const [created] = await this.db
      .insert(users)
      .values({
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        username: input.username,
        phone: input.phone,
        password: hashedPassword,
        gender: input.gender,
        role: input.role,
        status: input.status,
      })
      .returning();

    return this.mapDbUserToGraphqlUser(created);
  }

  async getUser(input: UserFilter): Promise<User | null> {
    const conditions = this.queryBuilder(input);
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const user = await this.db.query.users.findFirst({ where });

    return user ? this.mapDbUserToGraphqlUser(user) : null;
  }

  async getUsers(input: PaginateUserInput): Promise<PaginatedUser> {
    const { page, limit, search, ...rest } = input;
    const safePage = page || 1;
    const safeLimit = limit || 10;
    const offset = (safePage - 1) * safeLimit;

    const conditions = this.getFilterConditions({
      ...rest,
      search,
    });
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const docs = await this.db.query.users.findMany({
      where: where,
      orderBy: (users, { desc }) => [desc(users.createdAt)],
      limit: safeLimit,
      offset: offset,
    });

    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(where);

    const totalDocs = Number(count || 0);
    const totalPages = Math.max(1, Math.ceil(totalDocs / safeLimit));

    return {
      docs: docs.map((doc) => this.mapDbUserToGraphqlUser(doc)),
      totalDocs,
      limit: safeLimit,
      hasPrevPage: safePage > 1,
      hasNextPage: safePage < totalPages,
      page: safePage,
      totalPages,
      offset,
      prevPage: safePage > 1 ? safePage - 1 : null,
      nextPage: safePage < totalPages ? safePage + 1 : null,
      pagingCounter: totalDocs === 0 ? 0 : offset + 1,
    };
  }

  async updateUser(
    id: number,
    input: Omit<UpdateUserInput, '_id'>,
  ): Promise<User | null> {
    const userId = this.toUserIdNumber(id);

    if (userId === null) {
      return null;
    }

    if (input.password) {
      input.password = await argon2.hash(input.password);
    }

    const [updated] = await this.db
      .update(users)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return updated ? this.mapDbUserToGraphqlUser(updated) : null;
  }

  async softDeleteUser(id: number): Promise<User | null> {
    const userId = this.toUserIdNumber(id);

    if (userId === null) {
      return null;
    }

    const [updated] = await this.db
      .update(users)
      .set({ status: 'DELETED', updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    return updated ? this.mapDbUserToGraphqlUser(updated) : null;
  }
}
