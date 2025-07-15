import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { MongooseModule } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import * as mongoosePaginateV2 from 'mongoose-paginate-v2';
import * as mongooseUniqueValidator from 'mongoose-unique-validator';
import { AppResolver } from './app.resolver';
import { AppService } from './app.service';

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

          connection.on('connected', () => logger.log('MongoDB connected'));
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
      plugins: [ApolloServerPluginLandingPageLocalDefault()],
    }),
  ],
  providers: [AppService, AppResolver],
})
export class AppModule {}
