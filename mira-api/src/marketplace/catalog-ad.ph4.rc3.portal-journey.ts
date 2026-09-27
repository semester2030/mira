import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { Body, Controller, Get, Inject, Module, Post, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard';
import { PartnerRequest, PartnerTokenGuard } from '../partners-portal/guards/partner-token.guard';
import { PartnersPortalService } from '../partners-portal/partners-portal.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CatalogAdAdminController, CatalogAdPartnerController, CatalogAdPublicController } from './catalog-ad.controller';
import { CatalogAdService } from './catalog-ad.service';

@Controller('admin')
@UseGuards(AdminApiKeyGuard)
class JourneyOverviewController {
  @Get('stats/overview')
  overview() {
    return { journeyGate: 'local-only' };
  }
}

@Controller('partners-portal')
class JourneyPartnerSessionController {
  constructor(@Inject(PartnersPortalService) private readonly portal: PartnersPortalService) {}

  @Post('login')
  login(@Body() body: { email?: string; accessToken?: string }) {
    return this.portal.login(body?.email ?? '', body?.accessToken ?? '');
  }

  @Get('me')
  @UseGuards(PartnerTokenGuard)
  me(@Req() request: PartnerRequest) {
    return this.portal.getDashboard(request.partnerUser.partnerId);
  }
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule],
  controllers: [
    JourneyOverviewController,
    JourneyPartnerSessionController,
    CatalogAdPartnerController,
    CatalogAdAdminController,
    CatalogAdPublicController,
  ],
  providers: [CatalogAdService, PartnersPortalService, PartnerTokenGuard, AdminApiKeyGuard],
})
class JourneyModule {}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) process.exit(1);
  if (!url.includes('mira_ph2_rc6_test_ph4rc3ui')) process.exit(1);
  const prisma = new PrismaClient();
  const seller = await prisma.partner.create({ data: { type: 'brand', status: 'active', nameAr: 'جهة الرحلة المحلية', nameEn: 'Journey seller', city: 'الرياض' } });
  const celebrity = await prisma.partner.create({ data: { type: 'brand', status: 'active', nameAr: 'معلن الرحلة', nameEn: 'Journey advertiser', city: 'جدة' } });
  const token = 'a'.repeat(64);
  await prisma.partnerUser.create({ data: { partnerId: celebrity.id, email: 'ph4-rc3-ui@test.local', accessToken: token } });
  const product = await prisma.product.create({
    data: {
      partnerId: seller.id,
      nameAr: 'فستان الرحلة المحلية',
      nameEn: 'Journey dress',
      priceHalalas: 1800,
      externalUrl: 'https://example.com/journey-dress',
      concernTags: [],
      skinTypes: [],
      contentStatus: 'published',
      catalogSource: 'catalog',
      active: true,
    },
  });
  process.env.ADMIN_API_KEY = 'ph4-rc3-ui-admin';
  const app = await NestFactory.create(JourneyModule, { logger: ['error'] });
  app.enableCors({
    origin: ['http://127.0.0.1:8765', 'http://127.0.0.1:8766'],
    allowedHeaders: ['content-type', 'authorization', 'x-admin-key', 'accept'],
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: false, transform: false }));
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address();
  const port = typeof address === 'object' && address ? address.port : 0;
  writeFileSync('/tmp/ph4-rc3-journey.json', JSON.stringify({
    apiBase: `http://127.0.0.1:${port}/api/v1`,
    email: 'ph4-rc3-ui@test.local',
    token,
    adminKey: 'ph4-rc3-ui-admin',
    productId: product.id,
  }));
  console.log(`journey listening ${port}`);
  await new Promise(() => undefined);
}

void main();
