import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { json, type NextFunction, type Request, type Response } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { assertProviderPortsConfig } from './ports/config/provider-ports.config';
import { assertProductionIntegrity } from './config/production-integrity';
import { catalogRequestLimit } from './marketplace/catalog-content.policy';

async function bootstrap(): Promise<void> {
  assertProductionIntegrity(process.env);
  assertProviderPortsConfig(process.env);

  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use((req: Request, res: Response, next: NextFunction) => {
    const path = (req.originalUrl || req.url || '').split('?')[0];
    return json({ limit: catalogRequestLimit(req.method, path) })(req, res, next);
  });

  const config = app.get(ConfigService);
  const prefix = config.get<string>('API_PREFIX', 'api/v1');
  app.setGlobalPrefix(prefix);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const websiteOrigins = config
    .get<string>('WEBSITE_CORS_ORIGINS', '*')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: websiteOrigins.length === 1 && websiteOrigins[0] === '*'
      ? true
      : websiteOrigins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  const port = config.get<number>('PORT', 3000);
  await app.listen(port, '0.0.0.0');
}

bootstrap();
