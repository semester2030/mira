/**
 * Local-only Nest bootstrap for SBWS UI browser proof.
 * CORS open to 127.0.0.1 static portals. AUTH_SKIP for customer API seeding only.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('REFUSE: DATABASE_URL must be a local test database');
    process.exit(1);
  }
  const port = Number(process.env.PORT || 3099);
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.setGlobalPrefix(process.env.API_PREFIX || 'api/v1');
  app.enableCors({ origin: true, methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(port, '127.0.0.1');
  console.log('SBWS_UI_API_READY');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
