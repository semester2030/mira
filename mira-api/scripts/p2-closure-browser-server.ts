/**
 * Ephemeral Nest harness for P2.1/P2.2 portal journeys — brand + salon + developer,
 * with UploadSession finalize worker (memory multipart + memory catalog).
 */
import 'reflect-metadata';
import { Module, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { json, raw, type NextFunction, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { FirebaseIdTokenVerifier, VerifiedFirebaseIdentity } from '../src/common/auth/firebase-id-token-verifier';
import { FirebaseAuthGuard } from '../src/common/guards/firebase-auth.guard';
import { AdminApiKeyGuard } from '../src/common/guards/admin-api-key.guard';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { CatalogContentService } from '../src/marketplace/catalog-content.service';
import { CatalogMediaController } from '../src/marketplace/catalog-media.controller';
import { CatalogMediaStorage, MemoryCatalogMediaStorage } from '../src/marketplace/catalog-media.storage';
import { CatalogReviewAdminController } from '../src/marketplace/catalog-review.admin.controller';
import { MarketplaceController } from '../src/marketplace/marketplace.controller';
import { MarketplaceService } from '../src/marketplace/marketplace.service';
import { PartnerTokenGuard } from '../src/partners-portal/guards/partner-token.guard';
import { PartnersPortalController } from '../src/partners-portal/partners-portal.controller';
import { PartnersPortalService } from '../src/partners-portal/partners-portal.service';
import { hashPartnerPassword } from '../src/partners-portal/partner-password';
import { RegistryService } from '../src/partners-portal/registry/registry.service';
import { EditorDraftsService } from '../src/partners-portal/editor-drafts/editor-drafts.service';
import { ServiceProfileService } from '../src/partners-portal/editor-drafts/service-profile.service';
import { MemoryMultipartUploadStore, MultipartUploadStore } from '../src/partners-portal/upload-sessions/multipart.store';
import { UploadCleanupService } from '../src/partners-portal/upload-sessions/upload-cleanup.service';
import { UploadFinalizeService } from '../src/partners-portal/upload-sessions/upload-finalize.service';
import { UploadSessionsController } from '../src/partners-portal/upload-sessions/upload-sessions.controller';
import { UploadSessionsService } from '../src/partners-portal/upload-sessions/upload-sessions.service';

class ScriptedIdTokenVerifier extends FirebaseIdTokenVerifier {
  async verify(_token: string): Promise<VerifiedFirebaseIdentity> {
    throw new UnauthorizedException('unused');
  }
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule],
  controllers: [
    PartnersPortalController,
    CatalogMediaController,
    CatalogReviewAdminController,
    MarketplaceController,
    UploadSessionsController,
  ],
  providers: [
    PartnersPortalService,
    PartnerTokenGuard,
    AdminApiKeyGuard,
    CatalogContentService,
    RegistryService,
    EditorDraftsService,
    ServiceProfileService,
    FirebaseAuthGuard,
    UploadSessionsService,
    UploadFinalizeService,
    UploadCleanupService,
    { provide: MultipartUploadStore, useClass: MemoryMultipartUploadStore },
    { provide: CatalogMediaStorage, useClass: MemoryCatalogMediaStorage },
    { provide: MarketplaceService, useFactory: (prisma: PrismaService) => new MarketplaceService(prisma), inject: [PrismaService] },
    { provide: FirebaseIdTokenVerifier, useClass: ScriptedIdTokenVerifier },
  ],
})
class BrowserHarnessModule {}

function assertLocalDb(url: string) {
  const parsed = new URL(url);
  const host = (parsed.hostname || '').toLowerCase();
  if (host !== 'localhost' && host !== '127.0.0.1' && host !== '::1') {
    throw new Error(`REFUSE host ${host}`);
  }
}

async function main() {
  assertLocalDb(process.env.DATABASE_URL || '');
  process.env.MIRA_PARTNER_EDITOR_V2 = process.env.MIRA_PARTNER_EDITOR_V2 || 'true';
  process.env.MIRA_PARTNER_UPLOAD_SESSION = 'true';
  process.env.MIRA_UPLOAD_ALLOW_DIRECT_PARTS = 'true';
  process.env.MIRA_UPLOAD_PART_SIZE_BYTES = process.env.MIRA_UPLOAD_PART_SIZE_BYTES || '262144';
  process.env.MIRA_UPLOAD_FINALIZE_CONCURRENCY = process.env.MIRA_UPLOAD_FINALIZE_CONCURRENCY || '2';
  process.env.ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'p2-closure-admin';
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';

  const suffix = randomUUID().slice(0, 8);
  const password = `P2Pass!${suffix}`;
  const prisma = new PrismaClient();
  const brand = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: `متجر P2 ${suffix}`, nameEn: 'Brand P2', city: 'الرياض' },
  });
  const salon = await prisma.partner.create({
    data: { type: 'salon', status: 'active', nameAr: `صالون P2 ${suffix}`, nameEn: 'Salon P2', city: 'الرياض' },
  });
  const developer = await prisma.partner.create({
    data: { type: 'developer', status: 'active', nameAr: `مطوّر P2 ${suffix}`, nameEn: 'Dev P2', city: 'الرياض' },
  });
  const hash = await hashPartnerPassword(password);
  await prisma.partnerUser.create({
    data: { partnerId: brand.id, email: `brand-p2-${suffix}@test.local`, accessToken: `boot-b-${suffix}`, passwordHash: hash },
  });
  await prisma.partnerUser.create({
    data: {
      partnerId: salon.id,
      email: `salon-p2-${suffix}@test.local`,
      accessToken: `boot-s-${suffix}`,
      passwordHash: await hashPartnerPassword(password),
    },
  });
  await prisma.partnerUser.create({
    data: {
      partnerId: developer.id,
      email: `dev-p2-${suffix}@test.local`,
      accessToken: `boot-d-${suffix}`,
      passwordHash: await hashPartnerPassword(password),
    },
  });

  const app = await NestFactory.create(BrowserHarnessModule, { bodyParser: false, logger: ['error'] });
  app.enableCors({ origin: true, credentials: true });
  app.use((req: Request, res: Response, next: NextFunction) => {
    const path = (req.originalUrl || req.url || '').split('?')[0];
    if (req.method === 'PUT' && /\/upload-sessions\/[^/]+\/direct-parts\/\d+$/.test(path)) {
      return raw({ type: '*/*', limit: '64mb' })(req, res, next);
    }
    return json({ limit: '8mb' })(req, res, next);
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  await app.listen(0, '127.0.0.1');
  const addr = app.getHttpServer().address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  console.log(
    JSON.stringify({
      ready: true,
      port,
      password,
      brandEmail: `brand-p2-${suffix}@test.local`,
      salonEmail: `salon-p2-${suffix}@test.local`,
      developerEmail: `dev-p2-${suffix}@test.local`,
      brandId: brand.id,
      salonId: salon.id,
      developerId: developer.id,
      adminKey: process.env.ADMIN_API_KEY,
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
