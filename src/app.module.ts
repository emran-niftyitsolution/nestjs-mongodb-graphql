import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { Connection } from 'mongoose';
import * as mongoosePaginateV2 from 'mongoose-paginate-v2';
import * as mongooseUniqueValidator from 'mongoose-unique-validator';
import { AppResolver } from './app.resolver';
import { AppService } from './app.service';
import { GqlThrottlerGuard } from './common/guards/graphq-throttler.guard';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URI'),
        onConnectionCreate: (connection: Connection) => {
          const logger = new Logger('MongoDB', { timestamp: true });
          const dbName = configService
            .get<string>('MONGO_URI')
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

          return connection;
        },
      }),
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      playground: false,
      autoSchemaFile: true,
      sortSchema: true,
      plugins: [ApolloServerPluginLandingPageLocalDefault()],
      context: ({
        req,
        res,
      }: {
        req: Request;
        res: Response;
      }): { req: Request; res: Response } => ({ req, res }),
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: 10,
        },
      ],
    }),
    UserModule,
    AuthModule,
  ],
  providers: [
    AppService,
    AppResolver,
    {
      provide: APP_GUARD,
      useClass: GqlThrottlerGuard,
    },
  ],
})
export class AppModule {}
