import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export const DRIZZLE = Symbol('drizzle-connection');

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('Drizzle', { timestamp: true });
        const databaseURL = configService.get<string>('DATABASE_URL');

        if (!databaseURL) {
          throw new Error('DATABASE_URL is not set in environment variables.');
        }

        const pool = new Pool({
          connectionString: databaseURL,
        });

        pool.on('connect', () => logger.log('PostgreSQL connected'));
        pool.on('error', (error: Error) =>
          logger.error('PostgreSQL pool error', error.stack),
        );

        return drizzle(pool, { schema }) as NodePgDatabase<typeof schema>;
      },
    },
  ],
  exports: [DRIZZLE],
})
export class DrizzleModule {}
