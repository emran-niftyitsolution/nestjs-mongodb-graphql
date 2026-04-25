/* eslint-disable */
export default async () => {
  const t = {
    ['./user/schema/user.schema']: await import('./user/schema/user.schema'),
  };
  return {
    '@nestjs/graphql': {
      models: [
        [
          import('./activity-logs/schemas/activity-logs.schema'),
          {
            ActivityLog: {
              collectionName: {},
              action: {},
              user: { nullable: true },
              documentId: { nullable: true },
              payload: {},
              changes: {},
            },
          },
        ],
        [
          import('./user/schema/user.schema'),
          {
            User: {
              firstName: { type: () => String },
              lastName: { type: () => String },
              email: { type: () => String },
              username: { nullable: true, type: () => String },
              phone: { nullable: true, type: () => String },
              gender: {
                nullable: true,
                type: () => t['./user/schema/user.schema'].Gender,
              },
              role: {
                nullable: true,
                type: () => t['./user/schema/user.schema'].UserRole,
              },
              lastActiveAt: { nullable: true, type: () => Date },
              status: {
                nullable: true,
                type: () => t['./user/schema/user.schema'].UserStatus,
              },
              createdAt: { nullable: true, type: () => Date },
              updatedAt: { nullable: true, type: () => Date },
              _id: {},
              createdBy: { nullable: true },
            },
          },
        ],
        [
          import('./user/dtos/user.input'),
          {
            GetUserInput: {},
            PaginateUserInput: {
              search: { nullable: true, type: () => String },
              page: { nullable: true, type: () => Number },
              limit: { nullable: true, type: () => Number },
            },
            CreateUserInput: { password: { type: () => String } },
            UpdateUserInput: {
              password: { nullable: true, type: () => String },
              _id: {},
            },
            SoftDeleteUserInput: {},
            PaginatedUser: {},
          },
        ],
        [
          import('./auth/dtos/auth.input'),
          {
            LoginInput: {
              email: { type: () => String },
              password: { type: () => String },
              deviceName: { nullable: true },
            },
            SignupInput: {
              firstName: { type: () => String },
              lastName: { type: () => String },
              email: { type: () => String },
              password: { type: () => String },
              deviceName: { nullable: true },
            },
            LoginResponse: {
              accessToken: { type: () => String },
              refreshToken: { type: () => String },
              user: { type: () => t['./user/schema/user.schema'].User },
            },
            RefreshTokenInput: { refreshToken: { type: () => String } },
            LogoutResult: { success: {} },
            LogoutAllInput: { forUserId: { nullable: true } },
            UserSessionListEntry: {
              _id: {},
              userAgent: { nullable: true },
              ipAddress: { nullable: true },
              deviceName: { nullable: true },
              lastActiveAt: { nullable: true },
              createdAt: {},
              updatedAt: {},
              isCurrent: {},
            },
            RevokeSessionInput: { sessionId: {} },
          },
        ],
      ],
    },
  };
};
