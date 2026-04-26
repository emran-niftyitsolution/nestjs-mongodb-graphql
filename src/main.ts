import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import * as compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import type { AppEnv } from './config/env.validation';

declare const module: {
  hot?: {
    accept: () => void;
    dispose: (callback: () => void | Promise<void>) => void;
  };
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap', { timestamp: true });
  const configService = app.get(ConfigService<AppEnv, true>);
  const port = configService.getOrThrow('PORT');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  app.enableCors();
  app.use(compression());

  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: {
        directives: {
          imgSrc: [
            `'self'`,
            'data:',
            'apollo-server-landing-page.cdn.apollographql.com',
          ],
          scriptSrc: [`'self'`, `https: 'unsafe-inline'`],
          manifestSrc: [
            `'self'`,
            'apollo-server-landing-page.cdn.apollographql.com',
          ],
          frameSrc: [`'self'`, 'sandbox.embed.apollographql.com'],
        },
      },
    }),
  );

  await app.listen(port);
  logger.log(
    `Server is running on port ${port}; GraphQL endpoint: http://localhost:${port}/graphql`,
  );

  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => app.close());
  }
}
bootstrap().catch((err) => {
  Logger.error(err);
  process.exit(1);
});
