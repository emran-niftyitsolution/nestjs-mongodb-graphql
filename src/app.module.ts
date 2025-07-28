import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { GraphQLError } from 'graphql';
import { Connection } from 'mongoose';
import * as mongoosePaginateV2 from 'mongoose-paginate-v2';
import * as mongooseUniqueValidator from 'mongoose-unique-validator';
import { RequestContextModule } from 'nestjs-request-context';
import { ActivityLogModule } from './activity-logs/activity-logs.module';
import { ActivityLogService } from './activity-logs/activity-logs.service';
import { AppResolver } from './app.resolver';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { GqlAuthGuard } from './common/guards/gql-auth.guard';
import { GqlThrottlerGuard } from './common/guards/graphq-throttler.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { TrimPipe } from './common/pipes/trim.pipe';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    RequestContextModule,
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
        onConnectionCreate: (connection: Connection) => {
          const logger = new Logger('MongoDB', { timestamp: true });
          const dbName = configService
            .get<string>('MONGODB_URI')
            ?.split('/')
            .pop();

          connection.on('connected', () =>
            logger.log('MongoDB connected to ' + dbName),
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
      playground: false,
      autoSchemaFile: true,
      sortSchema: true,
      plugins: [ApolloServerPluginLandingPageLocalDefault() as any],
      context: ({
        req,
        res,
      }: {
        req: Request;
        res: Response;
      }): { req: Request; res: Response } => ({ req, res }),
      formatError: (error: GraphQLError) => {
        const { extensions, message, path } = error;
        const formattedError = {
          path,
          error: message,
          message:
            typeof extensions?.originalError === 'object' &&
            extensions?.originalError !== null &&
            'message' in extensions.originalError
              ? (extensions.originalError as { message?: string }).message ||
                message
              : message,
          status: extensions?.code || 'INTERNAL_SERVER_ERROR',
          statusCode:
            typeof extensions?.originalError === 'object' &&
            extensions?.originalError !== null &&
            'statusCode' in extensions.originalError
              ? (extensions.originalError as { statusCode?: number }).statusCode
              : null,
        };
        return formattedError;
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
