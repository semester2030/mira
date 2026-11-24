/**
 * Long-running acceptance host for celebrities v1:
 * - Creator/ad APIs (same module as HTTP integration test)
 * - Minimal portal login + /me so dashboard shell works
 * - Static partners-portal/web on the same origin
 *
 *   DATABASE_URL=postgresql://mira:mira_secret@localhost:5432/mira_creator_ads_v1_test \
 *   npx tsx src/marketplace/creator-ads.v1.acceptance-server.ts
 */
import 'reflect-metadata';
import { randomBytes, scrypt as scryptCb } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  Body,
  Controller,
  Get,
  Inject,
  Module,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaClient } from '@prisma/client';
import { timingSafeEqual } from 'node:crypto';
import express from 'express';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { PartnerRequest, PartnerTokenGuard } from '../partners-portal/guards/partner-token.guard';
import {
  CatalogAdAdminController,
  CatalogAdPartnerController,
  CatalogAdPublicController,
} from './catalog-ad.controller';
import { CatalogAdMediaService } from './catalog-ad-media.service';
import { CatalogAdService } from './catalog-ad.service';
import { CatalogMediaController } from './catalog-media.controller';
import { CatalogMediaStorage, MemoryCatalogMediaStorage } from './catalog-media.storage';
import {
  CreatorProfilePartnerController,
  CreatorProfilePublicController,
} from './creator-profile.controller';
import { CreatorProfileService } from './creator-profile.service';

const scrypt = promisify(scryptCb);
const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hashHex] = parts;
  const derived = (await scrypt(password, salt!, 64)) as Buffer;
  const expected = Buffer.from(hashHex!, 'hex');
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

/** Solid-color PNG (64×64) with optional label baked as unique RGB. */
function colorPngBase64(r: number, g: number, b: number): string {
  // Minimal valid 1×1 PNG recolored via IHDR+IDAT is hard; use distinct 1×1 palette via prebuilt
  // by rewriting: generate via raw zlib for solid RGB — fallback: unique tiny PNG from buffer.
  // Use ImageMagick-free approach: store unique bytes in tEXt by varying RGB in a hand-built PNG.
  const { deflateSync } = require('node:zlib') as typeof import('node:zlib');
  const width = 64;
  const height = 64;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const i = row + 1 + x * 3;
      // checker accent so faces differ visually beyond flat color
      const edge = x < 8 || y < 8 || x > 55 || y > 55;
      raw[i] = edge ? Math.min(255, r + 40) : r;
      raw[i + 1] = edge ? Math.min(255, g + 40) : g;
      raw[i + 2] = edge ? Math.min(255, b + 40) : b;
    }
  }
  const compressed = deflateSync(raw);
  function chunk(type: string, data: Buffer) {
    const typeBuf = Buffer.from(type, 'ascii');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const crcBuf = Buffer.concat([typeBuf, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcBuf) >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  }
  function crc32(buf: Buffer): number {
    let c = ~0;
    for (let i = 0; i < buf.length; i += 1) {
      c ^= buf[i]!;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
    }
    return ~c;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return png.toString('base64');
}

@Controller('partners-portal')
class AcceptancePortalAuthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Post('login')
  async login(@Body() body: { email?: string; password?: string }) {
    const email = String(body.email || '')
      .trim()
      .toLowerCase();
    const password = String(body.password || '');
    const user = await this.prisma.partnerUser.findFirst({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException('بيانات الدخول غير صحيحة');
    }
    const partner = await this.prisma.partner.findUniqueOrThrow({ where: { id: user.partnerId } });
    return {
      email: user.email,
      accessToken: user.accessToken,
      partner: { id: partner.id, type: partner.type, nameAr: partner.nameAr },
    };
  }

  @Get('me')
  @UseGuards(PartnerTokenGuard)
  async me(@Req() request: PartnerRequest) {
    const partnerId = request.partnerUser.partnerId;
    const partner = await this.prisma.partner.findUniqueOrThrow({ where: { id: partnerId } });
    const products = await this.prisma.product.findMany({
      where: { partnerId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const services = await this.prisma.service.findMany({
      where: { partnerId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return {
      partner: {
        id: partner.id,
        type: partner.type,
        nameAr: partner.nameAr,
        nameEn: partner.nameEn,
        status: partner.status,
        canSellProducts: true,
      },
      products: products.map((p) => ({
        id: p.id,
        nameAr: p.nameAr,
        nameEn: p.nameEn,
        contentStatus: p.contentStatus,
        active: p.active,
        priceHalalas: p.priceHalalas,
      })),
      services: services.map((s) => ({
        id: s.id,
        nameAr: s.nameAr,
        nameEn: s.nameEn,
        contentStatus: s.contentStatus,
        active: s.active,
        priceHalalas: s.priceHalalas,
        bookingEnabled: s.bookingEnabled,
      })),
    };
  }
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule],
  controllers: [
    CatalogAdPartnerController,
    CatalogAdAdminController,
    CatalogAdPublicController,
    CatalogMediaController,
    CreatorProfilePartnerController,
    CreatorProfilePublicController,
    AcceptancePortalAuthController,
  ],
  providers: [
    CatalogAdMediaService,
    CatalogAdService,
    CreatorProfileService,
    PartnerTokenGuard,
    AdminApiKeyGuard,
    { provide: CatalogMediaStorage, useClass: MemoryCatalogMediaStorage },
  ],
})
class CreatorAdsAcceptanceModule {}

async function seed(prisma: PrismaClient, run: string) {
  const password = 'AcceptTest1!';
  const passwordHash = await hashPassword(password);
  const token = `accept-token-${run}`;

  const developer = await prisma.partner.create({
    data: {
      type: 'developer',
      status: 'active',
      nameAr: `مطوّر قبول ${run}`,
      nameEn: 'Accept Dev',
      city: 'الرياض',
      canSellProducts: true,
    },
  });
  await prisma.partnerUser.create({
    data: {
      partnerId: developer.id,
      email: `dev-${run}@accept.local`,
      accessToken: token,
      passwordHash,
    },
  });

  // Developer's own product/service (prove they remain after celebrity register)
  const ownProduct = await prisma.product.create({
    data: {
      partnerId: developer.id,
      nameAr: `منتج المطوّر ${run}`,
      nameEn: 'Dev product',
      priceHalalas: 9900,
      externalUrl: 'https://example.com/dev-product',
      concernTags: [],
      skinTypes: [],
      contentStatus: 'published',
      catalogSource: 'catalog',
      active: true,
    },
  });
  const ownService = await prisma.service.create({
    data: {
      partnerId: developer.id,
      nameAr: `خدمة المطوّر ${run}`,
      nameEn: 'Dev service',
      priceHalalas: 15000,
      durationMin: 30,
      concernTags: [],
      contentStatus: 'published',
      catalogSource: 'catalog',
      active: true,
      bookingEnabled: true,
    },
  });

  const seller = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: `بائع ${run}`, nameEn: 'Seller', city: 'الرياض' },
  });
  const clinic = await prisma.partner.create({
    data: { type: 'clinic', status: 'active', nameAr: `عيادة ${run}`, nameEn: 'Clinic', city: 'الرياض' },
  });
  const product = await prisma.product.create({
    data: {
      partnerId: seller.id,
      nameAr: `كريم قبول ${run}`,
      nameEn: 'Cream',
      priceHalalas: 4500,
      externalUrl: 'https://example.com/cream',
      concernTags: [],
      skinTypes: [],
      contentStatus: 'published',
      catalogSource: 'catalog',
      active: true,
    },
  });
  const merchantMedia = await prisma.catalogMedia.create({
    data: {
      ownerKind: 'product',
      ownerId: product.id,
      kind: 'image',
      url: '',
      active: true,
      publication: 'published',
      storageKey: `merchant-${run}`,
      mimeType: 'image/png',
      sortOrder: 0,
      isPrimary: true,
      placement: 'main',
    },
  });
  const service = await prisma.service.create({
    data: {
      partnerId: clinic.id,
      nameAr: `جلسة قبول ${run}`,
      nameEn: 'Session',
      priceHalalas: 12000,
      durationMin: 45,
      concernTags: [],
      contentStatus: 'published',
      catalogSource: 'catalog',
      active: true,
      bookingEnabled: true,
    },
  });

  // Six extra celebrities with distinct colors (developer becomes 7th after register)
  const colors: Array<[number, number, number, string]> = [
    [220, 40, 40, 'حمراء'],
    [40, 120, 220, 'زرقاء'],
    [40, 180, 80, 'خضراء'],
    [220, 160, 40, 'صفراء'],
    [160, 60, 200, 'بنفسجية'],
    [30, 180, 180, 'فيروزية'],
  ];
  const extras: Array<{ id: string; name: string }> = [];
  for (let i = 0; i < colors.length; i += 1) {
    const [r, g, b, label] = colors[i]!;
    const p = await prisma.partner.create({
      data: {
        type: 'brand',
        status: 'active',
        nameAr: `شريك ${label} ${run}`,
        nameEn: `Extra${i}`,
        city: 'الرياض',
      },
    });
    const name = `مشهورة ${label} ${run}`;
    const c = await prisma.creatorProfile.create({
      data: {
        partnerId: p.id,
        displayNameAr: name,
        bioAr: `نبذة ${label}`,
        publicActive: true,
        avatarMime: 'image/png',
        avatarKey: `accept-avatar-${run}-${i}`,
      },
    });
    // Store avatar bytes via memory storage key convention used by CatalogMediaStorage —
    // CreatorProfileService uses CatalogMediaStorage for avatars; seed via API after boot instead.
    extras.push({ id: c.id, name });
    void colorPngBase64(r, g, b);
  }

  return {
    run,
    password,
    email: `dev-${run}@accept.local`,
    token,
    developerId: developer.id,
    ownProductId: ownProduct.id,
    ownServiceId: ownService.id,
    productId: product.id,
    serviceId: service.id,
    merchantMediaId: merchantMedia.id,
    extras,
    avatarPalette: colors.map((c, i) => ({ index: i, rgb: c.slice(0, 3), label: c[3] })),
  };
}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('acceptance: refuse non-local DATABASE_URL');
    process.exit(1);
  }
  const run = `acc-${Date.now()}`;
  process.env.ADMIN_API_KEY = `admin-${run}`;
  process.env.MIRA_VIEW_COUNTING_ENABLED = '0';

  const prisma = new PrismaClient();
  const seedInfo = await seed(prisma, run);

  const app = await NestFactory.create<NestExpressApplication>(CreatorAdsAcceptanceModule, {
    logger: ['error', 'warn', 'log'],
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.enableCors({ origin: true, credentials: true });

  const portalRoot = join(__dirname, '../../../partners-portal/web');
  if (!existsSync(portalRoot)) {
    console.error('missing portal web at', portalRoot);
    process.exit(1);
  }
  app.use(express.static(portalRoot));

  const port = Number(process.env.ACCEPTANCE_PORT || 3000);
  await app.listen(port, '0.0.0.0');

  const evidenceDir = join(__dirname, '../../../docs/creator-ads/evidence/acceptance-live');
  mkdirSync(evidenceDir, { recursive: true });
  const meta = {
    ok: true,
    impl_commit_expected: '5dc38be',
    run: seedInfo.run,
    api: `http://127.0.0.1:${port}/api/v1`,
    portal: `http://127.0.0.1:${port}/login.html`,
    dashboard: `http://127.0.0.1:${port}/dashboard.html`,
    email: seedInfo.email,
    password: seedInfo.password,
    token: seedInfo.token,
    developerId: seedInfo.developerId,
    ownProductId: seedInfo.ownProductId,
    ownServiceId: seedInfo.ownServiceId,
    productId: seedInfo.productId,
    serviceId: seedInfo.serviceId,
    merchantMediaId: seedInfo.merchantMediaId,
    extras: seedInfo.extras,
    avatarPalette: seedInfo.avatarPalette,
    note: 'Portal served same-origin; login uses seeded developer. Register celebrity via UI or API.',
  };
  writeFileSync(join(evidenceDir, 'SERVER.json'), JSON.stringify(meta, null, 2));
  writeFileSync(
    join(evidenceDir, 'CREDS.txt'),
    `email=${seedInfo.email}\npassword=${seedInfo.password}\nportal=${meta.portal}\napi=${meta.api}\n`,
  );
  console.log(JSON.stringify({ ready: true, ...meta }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
