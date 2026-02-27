import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import helmet from 'helmet';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.use(
    helmet({
      contentSecurityPolicy: false, // Disable CSP for Swagger UI
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Bulk Upload Service')
    .setDescription(
      'CSV bulk-upload API with JWT & API-key authentication and rate-limiting.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT',
    )
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'ApiKey')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const configService = app.get<ConfigService>(ConfigService);
  const port = configService.get<number>('PORT') || 3000;
  const corsOrigin = configService.get<string>('CORS_ORIGIN') || '*';

  app.enableCors({
    origin: corsOrigin,
    methods: ['GET', 'POST', 'DELETE'],
    credentials: true,
  });

  await app.listen(port);

  logger.log(`Server:  http://localhost:${port}`);
  logger.log(`UI:      http://localhost:${port}`);
  logger.log(`Swagger: http://localhost:${port}/api/docs`);
}

bootstrap();
