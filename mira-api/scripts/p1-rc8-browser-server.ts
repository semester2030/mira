/**
 * Ephemeral Nest harness for RC8 browser E2E — brand + salon partners (not developer).
 */
import 'reflect-metadata';
import { Module, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
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

class ScriptedIdTokenVerifier extends FirebaseIdTokenVerifier {
  async verify(_token: string): Promise<VerifiedFirebaseIdentity> {
    throw new UnauthorizedException('unused');
  }
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule],
  controllers: [PartnersPortalController, CatalogMediaController, CatalogReviewAdminController, MarketplaceController],
  providers: [
    PartnersPortalService,
    PartnerTokenGuard,
    AdminApiKeyGuard,
    CatalogContentService,
    RegistryService,
    EditorDraftsService,
    ServiceProfileService,
    FirebaseAuthGuard,
    { provide: CatalogMediaStorage, useClass: MemoryCatalogMediaStorage },
    { provide: MarketplaceService, useFactory: (prisma: PrismaService) => new MarketplaceService(prisma), inject: [PrismaService] },
    { provide: FirebaseIdTokenVerifier, useClass: ScriptedIdTokenVerifier },
  ],
})
class BrowserHarnessModule {}

function assertRc6Db(url: string) {
  const parsed = new URL(url);
  const host = parsed.hostname;
  const db = parsed.pathname.replace(/^\//, '').split('?')[0];
  if (host !== 'localhost' && host !== '127.0.0.1') throw new Error(`REFUSE host ${host}`);
  if (db !== 'mira_p1_rc8_test') throw new Error(`REFUSE db ${db}`);
}

async function main() {
  assertRc6Db(process.env.DATABASE_URL || '');
  process.env.MIRA_PARTNER_EDITOR_V2 = 'true';
  process.env.ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'p1-rc8-admin';

  const suffix = randomUUID().slice(0, 8);
  const password = `Rc4Pass!${suffix}`;
  const prisma = new PrismaClient();
  const brand = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: `متجر RC8 ${suffix}`, nameEn: 'Brand RC8', city: 'الرياض' },
  });
  const salon = await prisma.partner.create({
    data: { type: 'salon', status: 'active', nameAr: `صالون RC8 ${suffix}`, nameEn: 'Salon RC8', city: 'الرياض' },
  });
  const clinic = await prisma.partner.create({
    data: { type: 'clinic', status: 'active', nameAr: `عيادة RC8 ${suffix}`, nameEn: 'Clinic RC8', city: 'الرياض' },
  });
  const hash = await hashPartnerPassword(password);
  await prisma.partnerUser.create({
    data: { partnerId: brand.id, email: `brand-rc8-b-${suffix}@test.local`, accessToken: `boot-b-${suffix}`, passwordHash: hash },
  });
  await prisma.partnerUser.create({
    data: {
      partnerId: salon.id,
      email: `salon-rc8-b-${suffix}@test.local`,
      accessToken: `boot-s-${suffix}`,
      passwordHash: await hashPartnerPassword(password),
    },
  });
  await prisma.partnerUser.create({
    data: {
      partnerId: clinic.id,
      email: `clinic-rc8-b-${suffix}@test.local`,
      accessToken: `boot-c-${suffix}`,
      passwordHash: await hashPartnerPassword(password),
    },
  });

  const app = await NestFactory.create(BrowserHarnessModule, { logger: ['error'] });
  app.enableCors({ origin: true, credentials: true });
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
      brandEmail: `brand-rc8-b-${suffix}@test.local`,
      salonEmail: `salon-rc8-b-${suffix}@test.local`,
      clinicEmail: `clinic-rc8-b-${suffix}@test.local`,
      brandId: brand.id,
      salonId: salon.id,
      clinicId: clinic.id,
      adminKey: process.env.ADMIN_API_KEY,
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
