import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { ThrottlerModule } from '@nestjs/throttler';
import { FastifyReply, FastifyRequest } from 'fastify';
import { GraphQLError, GraphQLFormattedError } from 'graphql';
import GraphQLJSON from 'graphql-type-json';
import { RequestContextModule } from 'nestjs-request-context';
import { ActivityLogModule } from './activity-logs/activity-logs.module';
import { AppResolver } from './app.resolver';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { GqlAuthGuard } from './common/guards/gql-auth.guard';
import { GqlThrottlerGuard } from './common/guards/graphq-throttler.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { TrimPipe } from './common/pipes/trim.pipe';
import { DrizzleModule } from './database/drizzle.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    RequestContextModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      playground: false,
      autoSchemaFile: true,
      sortSchema: true,
      resolvers: { JSON: GraphQLJSON },
      plugins: [ApolloServerPluginLandingPageLocalDefault() as any],
      context: ({
        req,
        res,
      }: {
        req: FastifyRequest;
        res: FastifyReply;
      }): { req: FastifyRequest; res: FastifyReply } => ({ req, res }),
      formatError: (
        formattedError: GraphQLFormattedError,
        error: unknown,
      ): GraphQLFormattedError => {
        const originalError =
          error instanceof GraphQLError ? error.originalError : undefined;

        const original =
          typeof originalError === 'object' && originalError !== null
            ? (originalError as { message?: string; statusCode?: number })
            : undefined;

        return {
          ...formattedError,
          message: original?.message ?? formattedError.message,
          extensions: {
            ...formattedError.extensions,
            error: formattedError.message,
            status: formattedError.extensions?.code ?? 'INTERNAL_SERVER_ERROR',
            statusCode: original?.statusCode ?? null,
          },
        };
      },
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: 30,
        },
      ],
    }),
    ActivityLogModule,
    DrizzleModule,
    UserModule,
    AuthModule,
  ],
  providers: [
    AppService,
    AppResolver,
    {
      provide: APP_PIPE,
      useClass: TrimPipe,
    },
    {
      provide: APP_GUARD,
      useClass: GqlThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: GqlAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
