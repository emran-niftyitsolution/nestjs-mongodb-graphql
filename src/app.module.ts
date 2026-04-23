import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { GraphQLFormattedError } from 'graphql';
import type { Connection } from 'mongoose';

import mongoosePaginateV2 = require('mongoose-paginate-v2');

import mongooseUniqueValidator = require('mongoose-unique-validator');

import { RequestContextModule } from 'nestjs-request-context';
import { ActivityLogModule } from './activity-logs/activity-logs.module';
import { ActivityLogService } from './activity-logs/activity-logs.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { GqlAuthGuard } from './common/guards/gql-auth.guard';
import { GqlThrottlerGuard } from './common/guards/graphq-throttler.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { TrimPipe } from './common/pipes/trim.pipe';
import { validateEnv } from './config/env.validation';
import metadata from './metadata';
// Serializes GraphQL code-first field metadata (Nest CLI + SWC). See: https://docs.nestjs.com/graphql/cli-plugin#swc-builder
import { UserModule } from './user/user.module';

interface GraphQLContext {
  req: Request;
  res: Response;
}

interface GraphQLAppError extends GraphQLFormattedError {
  error: string;
  status: string;
  statusCode: number | null;
}

function landingPagePlugin(): NonNullable<
  ApolloDriverConfig['plugins']
>[number] {
  // Bridge CJS/ESM private-type mismatch for Apollo plugin types under strict mode.
  return ApolloServerPluginLandingPageLocalDefault() as unknown as NonNullable<
    ApolloDriverConfig['plugins']
  >[number];
}

function getOriginalErrorDetails(error: unknown): {
  message?: string;
  statusCode?: number;
} {
  if (typeof error !== 'object' || error === null) {
    return {};
  }

  const originalError = error as {
    message?: unknown;
    statusCode?: unknown;
  };

  return {
    ...(typeof originalError.message === 'string'
      ? { message: originalError.message }
      : {}),
    ...(typeof originalError.statusCode === 'number'
      ? { statusCode: originalError.statusCode }
      : {}),
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      validate: validateEnv,
    }),
    RequestContextModule,
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.getOrThrow<string>('MONGODB_URI'),
        onConnectionCreate: (connection: Connection) => {
          const logger = new Logger('MongoDB', { timestamp: true });
          const dbName = configService
            .getOrThrow<string>('MONGODB_URI')
            ?.split('/')
            .pop();

          connection.on('connected', () =>
            logger.log(`MongoDB connected to ${dbName}`),
          );
          connection.on('open', () => logger.log('MongoDB open'));
          connection.on('disconnected', () =>
            logger.log('MongoDB disconnected'),
          );
          connection.on('reconnected', () => logger.log('MongoDB reconnected'));
          connection.on('disconnecting', () =>
            logger.log('MongoDB disconnecting'),
          );

          connection.plugin(mongoosePaginateV2);
          connection.plugin(mongooseUniqueValidator, {
            message: 'Error, expected {PATH} to be unique.',
          });
          connection.plugin(ActivityLogService.apply);

          return connection;
        },
      }),
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      metadata,
      playground: false,
      autoSchemaFile: true,
      sortSchema: true,
      plugins: [landingPagePlugin()],
      context: ({ req, res }: GraphQLContext): GraphQLContext => ({ req, res }),
      formatError: (formattedError, error): GraphQLAppError => {
        const details = getOriginalErrorDetails(error);

        return {
          ...formattedError,
          error: details.message ?? formattedError.message,
          message: details.message ?? formattedError.message,
          status: formattedError.extensions?.code
            ? String(formattedError.extensions.code)
            : 'INTERNAL_SERVER_ERROR',
          statusCode: details.statusCode ?? null,
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
    UserModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
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
