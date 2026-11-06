/**
 * P5-C06: measure catalog+facets latency on representative local data.
 * Proposed engineering budgets (not owner-signed): p95 < 800ms, p99 < 1500ms for limit=24 facets=1.
 * Run with local DATABASE_URL + MIRA_PARTNER_EDITOR_V2=true.
 */
import 'reflect-metadata';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { FirebaseIdTokenVerifier } from '../src/common/auth/firebase-id-token-verifier';
import { UnauthorizedException } from '@nestjs/common';
import { FirebaseAuthGuard } from '../src/common/guards/firebase-auth.guard';
import { AdminApiKeyGuard } from '../src/common/guards/admin-api-key.guard';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
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
import { RegistryService } from '../src/partners-portal/registry/registry.service';
import { BulkBatchesService } from '../src/partners-portal/bulk-batches/bulk-batches.service';
import { EditorDraftsService } from '../src/partners-portal/editor-drafts/editor-drafts.service';
import { ServiceProfileService } from '../src/partners-portal/editor-drafts/service-profile.service';
import { VariantInventoryService } from '../src/partners-portal/variant-inventory.service';
import { CommerceService } from '../src/marketplace/commerce.service';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '../../audit-out/p0-p7-final/logs/p5-c06-facets');
mkdirSync(outDir, { recursive: true });

class DenyVerifier extends FirebaseIdTokenVerifier {
  async verify() {
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
    BulkBatchesService,
    ServiceProfileService,
    VariantInventoryService,
    CommerceService,
    FirebaseAuthGuard,
    { provide: CatalogMediaStorage, useClass: MemoryCatalogMediaStorage },
    { provide: MarketplaceService, useFactory: (prisma) => new MarketplaceService(prisma), inject: [PrismaService] },
    { provide: FirebaseIdTokenVerifier, useClass: DenyVerifier },
  ],
})
class C06Module {}

function pct(sorted: number[], p: number) {
  if (!sorted.length) return null;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return Math.round(sorted[i] * 100) / 100;
}

async function main() {
  const url = process.env.DATABASE_URL || '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('REFUSE: local DATABASE_URL');
    process.exit(1);
  }
  process.env.MIRA_PARTNER_EDITOR_V2 = 'true';
  process.env.ADMIN_API_KEY = 'c06-admin';
  const started = new Date().toISOString();
  const suffix = randomUUID().slice(0, 8);
  const rounds = Number(process.env.C06_ROUNDS || 40);
  const proposed = { p95Ms: 800, p99Ms: 1500, note: 'engineering_proposal_not_owner_signed' };

  const prisma = new PrismaClient();
  const partner = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: `C06 ${suffix}`, nameEn: 'c06', city: 'الرياض' },
  });
  const colors = ['black', 'ivory', 'pink', 'blue'];
  const sizes = ['XS', 'S', 'M', 'L'];
  const N = Number(process.env.C06_N || 80);
  for (let i = 0; i < N; i++) {
    const color = colors[i % colors.length];
    const size = sizes[i % sizes.length];
    await prisma.product.create({
      data: {
        partnerId: partner.id,
        nameAr: `C06P ${i}`,
        nameEn: `c06p-${i}`,
        priceHalalas: 10000 + (i % 20) * 100,
        externalUrl: 'https://example.test/c06',
        concernTags: [],
        skinTypes: [],
        purchaseMode: 'internal_cod',
        active: true,
        contentStatus: 'published',
        reviewStatus: 'approved',
        inventoryMode: 'variant',
        optionsJson: [
          { id: 'color', values: [{ id: color, labelAr: color }] },
          { id: 'size', values: [{ id: size, labelAr: size }] },
        ],
        variantsJson: [
          {
            id: `${color}-${size}-${i}`,
            selections: { color, size },
            priceHalalas: 10000 + (i % 20) * 100,
            available: true,
            stockQty: 3,
          },
        ],
      },
    });
  }
  for (let i = 0; i < 20; i++) {
    await prisma.service.create({
      data: {
        partnerId: partner.id,
        nameAr: `C06S ${i}`,
        nameEn: `c06s-${i}`,
        durationMin: 45,
        priceHalalas: 15000,
        concernTags: [],
        bookingEnabled: true,
        active: true,
        contentStatus: 'published',
        reviewStatus: 'approved',
        availabilityJson: {
          v: 2,
          timezone: 'Asia/Riyadh',
          windows: [{ weekday: i % 7, startMin: 600, endMin: 1080, capacity: 1, resourceId: 'r1' }],
          exceptions: [],
          closedDates: [],
        },
      },
    });
  }

  const app = await NestFactory.create(C06Module, { logger: ['error'] });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(0);
  const port = (app.getHttpServer().address() as { port: number }).port;
  const base = `http://127.0.0.1:${port}`;

  const urls = [
    `${base}/api/v1/marketplace/catalog?partnerId=${partner.id}&kind=product&facets=1&limit=24`,
    `${base}/api/v1/marketplace/catalog?partnerId=${partner.id}&kind=product&variant.color=black&facets=1&limit=24`,
    `${base}/api/v1/marketplace/catalog?partnerId=${partner.id}&kind=service&facets=1&limit=24`,
  ];

  const samples = [];
  for (const u of urls) {
    const times: number[] = [];
    let lastStatus = 0;
    let lastN = 0;
    let hasFacets = false;
    let emptyOk = true;
    for (let i = 0; i < rounds; i++) {
      const t0 = performance.now();
      const res = await fetch(u);
      const body = await res.json().catch(() => ({}));
      const ms = performance.now() - t0;
      times.push(ms);
      lastStatus = res.status;
      lastN = (body.items || body.results || []).length;
      hasFacets = !!body.facets;
      if (res.status !== 200) emptyOk = false;
      if (u.includes('kind=product') && !u.includes('variant.color') && lastN === 0) emptyOk = false;
    }
    times.sort((a, b) => a - b);
    const p95 = pct(times, 95);
    const p99 = pct(times, 99);
    samples.push({
      url: u.replace(partner.id, '<partner>').replace(base, '<base>'),
      rounds,
      lastStatus,
      lastN,
      hasFacets,
      emptyOk,
      p50: pct(times, 50),
      p95,
      p99,
      min: Math.round(times[0] * 100) / 100,
      max: Math.round(times[times.length - 1] * 100) / 100,
      meetsProposed: emptyOk && lastStatus === 200 && p95 != null && p95 <= proposed.p95Ms && p99 != null && p99 <= proposed.p99Ms,
    });
  }

  const report = {
    id: 'P5_C06_FACETS_TIMING',
    started,
    finished: new Date().toISOString(),
    dataVolume: { products: N, services: 20, partnerId: partner.id },
    environment: { base, db: 'localhost', concurrency: 1, rounds },
    proposedBudget: proposed,
    samples,
    verdict: samples.every((s) => s.meetsProposed)
      ? 'MEETS_PROPOSED_BUDGET'
      : samples.every((s) => s.emptyOk && s.lastStatus === 200)
        ? 'MEASURED_ABOVE_PROPOSED'
        : 'MEASURED_WITH_ERRORS',
    noteAr:
      'قياسات فعلية محلية. الميزانية مقترحة هندسيًا وليست معيار مالك موقّع. ليست DEVICE/إنتاج.',
  };
  writeFileSync(join(outDir, 'RESULTS.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  await app.close();
  await prisma.$disconnect();
  process.exit(report.verdict === 'MEASURED_WITH_ERRORS' ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
