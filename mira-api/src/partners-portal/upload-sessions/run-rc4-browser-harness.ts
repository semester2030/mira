/**
 * Starts slim UploadSession API + runs Playwright U04/F06 journey.
 */
import 'reflect-metadata';
import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { json, raw, type NextFunction, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { spawn } from 'child_process';
import { join } from 'path';
import { PrismaModule } from '../../prisma/prisma.module';
import { CatalogMediaStorage, MemoryCatalogMediaStorage } from '../../marketplace/catalog-media.storage';
import { PartnerTokenGuard } from '../guards/partner-token.guard';
import { MemoryMultipartUploadStore, MultipartUploadStore } from './multipart.store';
import { UploadCleanupService } from './upload-cleanup.service';
import { UploadFinalizeService } from './upload-finalize.service';
import { UploadSessionsController } from './upload-sessions.controller';
import { UploadSessionsService } from './upload-sessions.service';

process.env.MIRA_PARTNER_UPLOAD_SESSION = 'true';
process.env.NODE_ENV = 'test';
process.env.MIRA_UPLOAD_ALLOW_DIRECT_PARTS = 'true';
process.env.MIRA_UPLOAD_PART_SIZE_BYTES = '262144';

async function main() {
  const url = process.env.DATABASE_URL || '';
  const host = new URL(url).hostname;
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
    console.error('REFUSE non-local DB');
    process.exit(1);
  }
  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const brand = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: `BRC4 ${suffix}`, nameEn: 'B', city: 'الرياض' },
  });
  const token = `token-brc4-${suffix}`;
  await prisma.partnerUser.create({
    data: { partnerId: brand.id, email: `brc4-${suffix}@test.local`, accessToken: token },
  });
  const service = await prisma.service.create({
    data: {
      partnerId: brand.id,
      nameAr: 'خدمة متصفح',
      nameEn: 'Browser',
      durationMin: 30,
      priceHalalas: 1000,
      concernTags: [],
      contentStatus: 'draft',
      reviewStatus: 'draft',
    },
  });

  @Module({
    imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule],
    controllers: [UploadSessionsController],
    providers: [
      PartnerTokenGuard,
      UploadSessionsService,
      UploadFinalizeService,
      UploadCleanupService,
      { provide: MultipartUploadStore, useClass: MemoryMultipartUploadStore },
      { provide: CatalogMediaStorage, useClass: MemoryCatalogMediaStorage },
    ],
  })
  class BrowserApiModule {}

  const app = await NestFactory.create(BrowserApiModule, { bodyParser: false, logger: ['error'] });
  app.enableCors({
    origin: true,
    credentials: true,
    exposedHeaders: ['ETag', 'etag', 'Content-Range', 'Accept-Ranges'],
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    const path = (req.originalUrl || req.url || '').split('?')[0];
    if (req.method === 'PUT' && /\/upload-sessions\/[^/]+\/direct-parts\/\d+$/.test(path)) {
      return raw({ type: '*/*', limit: '64mb' })(req, res, next);
    }
    return json({ limit: '2mb' })(req, res, next);
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  await app.listen(0);
  const address = app.getHttpServer().address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const base = `http://127.0.0.1:${port}/api/v1`;

  const env = {
    ...process.env,
    MIRA_RC4_BROWSER_BASE: base,
    MIRA_RC4_BROWSER_TOKEN: token,
    MIRA_RC4_BROWSER_OWNER_ID: service.id,
    MIRA_P21_OUT_DIR: process.env.MIRA_P21_OUT_DIR || join(process.cwd(), '..', 'audit-out', 'p2-1-rc4', 'logs', 'browser'),
  };
  const child = spawn('npx', ['tsx', 'src/partners-portal/upload-sessions/upload-sessions.rc4.browser.mjs'], {
    cwd: process.cwd(),
    env,
    stdio: 'inherit',
  });
  const code: number = await new Promise((resolve) => child.on('exit', (c) => resolve(c ?? 1)));
  await app.close();
  await prisma.$disconnect();
  process.exit(code);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
