import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap', { timestamp: true });

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

  await app.listen(process.env.PORT ?? 3000);
  logger.log(
    '-------------------------------------------',
    `Server is running on port ${process.env.PORT ?? 3000}`,
    `GraphQL playground: http://localhost:${process.env.PORT ?? 3000}/graphql`,
    '-------------------------------------------',
  );
}
bootstrap().catch((err) => {
  Logger.error(err);
  process.exit(1);
});
