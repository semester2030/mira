import 'reflect-metadata';
import assert from 'node:assert/strict';
import { INestApplication, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { UnauthorizedException } from '@nestjs/common';
import { FirebaseIdTokenVerifier, VerifiedFirebaseIdentity } from '../common/auth/firebase-id-token-verifier';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';

class ScriptedIdTokenVerifier extends FirebaseIdTokenVerifier {
  constructor(private readonly known: Record<string, string>) {
    super();
  }

  async verify(token: string): Promise<VerifiedFirebaseIdentity> {
    const uid = this.known[token];
    if (!uid) throw new UnauthorizedException('Invalid or expired Firebase token');
    return { uid, email: `${uid}@test.local`, name: uid };
  }
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule],
  controllers: [MarketplaceController],
  providers: [
    {
      provide: MarketplaceService,
      useFactory: (prisma: PrismaService) => new MarketplaceService(prisma),
      inject: [PrismaService],
    },
    {
      provide: FirebaseIdTokenVerifier,
      useValue: new ScriptedIdTokenVerifier({ 'token-a': 'uid-rc5-a', 'token-b': 'uid-rc5-b' }),
    },
  ],
})
class MarketplaceHttpTestModule {}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('REFUSE: DATABASE_URL must be a local test database');
    process.exit(1);
  }
  process.env.MIRA_AUTH_FIXTURE = '1';
  process.env.MIRA_AUTH_FIXTURE_TOKENS = JSON.stringify({ 'legacy-token': 'uid-should-not-bind' });
  process.env.AUTH_SKIP = 'false';

  const app = await NestFactory.create(MarketplaceHttpTestModule, { logger: ['error'] });
  app.setGlobalPrefix('api/v1');
  await app.listen(0);
  const base = await baseUrl(app);
  const prisma = new PrismaClient();

  const missing = await fetch(`${base}/api/v1/marketplace/favorites`);
  assert.equal(missing.status, 401, await missing.text());
  const bad = await fetch(`${base}/api/v1/marketplace/favorites`, {
    headers: { authorization: 'Bearer not-a-token' },
  });
  assert.equal(bad.status, 401);
  const emptyBearer = await fetch(`${base}/api/v1/marketplace/favorites`, {
    headers: { authorization: 'Bearer    ' },
  });
  assert.equal(emptyBearer.status, 401);
  const legacy = await fetch(`${base}/api/v1/marketplace/favorites`, {
    headers: { authorization: 'Bearer legacy-token' },
  });
  assert.equal(legacy.status, 401, 'old fixture settings must not authorize the runtime guard');

  await prisma.user.create({ data: { firebaseUid: 'uid-rc5-a', email: 'a@rc5.local' } });
  await prisma.user.create({ data: { firebaseUid: 'uid-rc5-b', email: 'b@rc5.local' } });
  const partner = await prisma.partner.findFirst({ where: { status: 'active' } });
  assert.ok(partner);
  const product = await prisma.product.findFirst({ where: { active: true, priceHalalas: 8900 } });
  assert.ok(product);

  const fresh = await prisma.product.create({
    data: {
      partnerId: partner.id,
      nameAr: 'أول حفظ متزامن',
      nameEn: 'First concurrent save',
      priceHalalas: 1500,
      externalUrl: 'https://example.com',
      concernTags: [],
      skinTypes: [],
      active: true,
    },
  });
  const [raceA, raceB] = await Promise.all([
    postFavorite(base, 'token-a', { kind: 'product', id: fresh.id, saved: true }),
    postFavorite(base, 'token-a', { kind: 'product', id: fresh.id, saved: true }),
  ]);
  assert.equal(raceA.status, 201, await raceA.clone().text());
  assert.equal(raceB.status, 201, await raceB.clone().text());
  assert.equal(
    await prisma.catalogFavorite.count({ where: { ownerKind: 'product', ownerId: fresh.id } }),
    1,
  );
  const [dropA, dropB] = await Promise.all([
    postFavorite(base, 'token-a', { kind: 'product', id: fresh.id, saved: false }),
    postFavorite(base, 'token-a', { kind: 'product', id: fresh.id, saved: false }),
  ]);
  assert.equal(dropA.status, 201);
  assert.equal(dropB.status, 201);
  assert.equal(
    await prisma.catalogFavorite.count({ where: { ownerKind: 'product', ownerId: fresh.id } }),
    0,
  );
  const userA = await prisma.user.findUniqueOrThrow({ where: { firebaseUid: 'uid-rc5-a' } });
  const userB = await prisma.user.findUniqueOrThrow({ where: { firebaseUid: 'uid-rc5-b' } });
  const spoof = await fetch(`${base}/api/v1/marketplace/favorites`, {
    method: 'POST',
    headers: { authorization: 'Bearer token-a', 'content-type': 'application/json' },
    body: JSON.stringify({ kind: 'product', id: product.id, saved: true, firebaseUid: 'uid-rc5-b' }),
  });
  assert.equal(spoof.status, 201);
  assert.equal(await prisma.catalogFavorite.count({ where: { userId: userA.id, ownerId: product.id } }), 1);
  assert.equal(await prisma.catalogFavorite.count({ where: { userId: userB.id } }), 0);

  const save = await postFavorite(base, 'token-a', { kind: 'product', id: product.id, saved: true });
  assert.equal(save.status, 201, await save.text().catch(() => ''));
  const again = await postFavorite(base, 'token-a', { kind: 'product', id: product.id, saved: true });
  assert.equal(again.status, 201, 'same request after a lost response stays one row');
  const rows = await prisma.catalogFavorite.count({
    where: { ownerKind: 'product', ownerId: product.id },
  });
  assert.equal(rows, 1);

  const [first, second] = await Promise.all([
    postFavorite(base, 'token-a', { kind: 'product', id: product.id, saved: true }),
    postFavorite(base, 'token-a', { kind: 'product', id: product.id, saved: true }),
  ]);
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.equal(
    await prisma.catalogFavorite.count({ where: { ownerKind: 'product', ownerId: product.id } }),
    1,
  );

  const other = await fetch(`${base}/api/v1/marketplace/favorites`, {
    headers: { authorization: 'Bearer token-b' },
  });
  const otherBody = (await other.json()) as { items: unknown[] };
  assert.equal(otherBody.items.length, 0);

  const removed = await postFavorite(base, 'token-a', { kind: 'product', id: product.id, saved: false });
  assert.equal(removed.status, 201);
  const removedAgain = await postFavorite(base, 'token-a', { kind: 'product', id: product.id, saved: false });
  assert.equal(removedAgain.status, 201);
  assert.equal(
    await prisma.catalogFavorite.count({ where: { ownerKind: 'product', ownerId: product.id } }),
    0,
  );

  const missingItem = await postFavorite(base, 'token-a', { kind: 'product', id: 'missing-item', saved: true });
  assert.equal(missingItem.status, 404);
  const draft = await prisma.product.create({
    data: {
      partnerId: partner.id,
      nameAr: 'مسودة',
      nameEn: 'Draft',
      priceHalalas: 100,
      externalUrl: 'https://example.com',
      concernTags: [],
      skinTypes: [],
      active: false,
      category: null,
    },
  });
  const unpublished = await postFavorite(base, 'token-a', { kind: 'product', id: draft.id, saved: true });
  assert.equal(unpublished.status, 404);

  const catalog = await fetch(`${base}/api/v1/marketplace/catalog?limit=24`);
  assert.equal(catalog.status, 200);
  const catalogBody = (await catalog.json()) as { items: { id: string; kind: string }[] };
  const detail = await fetch(`${base}/api/v1/marketplace/catalog/product/${product.id}`);
  assert.equal(detail.status, 200);
  const detailBody = (await detail.json()) as { id: string; priceLabel: string; category: string | null };
  assert.equal(detailBody.id, product.id);
  assert.equal(detailBody.priceLabel, '89 ر.س');

  for (const id of ['A', 'a', 'b', 'a-b', 'a_b', 'ab']) {
    await prisma.product.create({
      data: {
        id,
        partnerId: partner.id,
        nameAr: id,
        nameEn: id,
        priceHalalas: 100,
        externalUrl: 'https://example.com',
        concernTags: [],
        skinTypes: [],
        active: true,
      },
    });
  }
  const seen = new Set<string>();
  let cursor: string | null = null;
  for (let page = 0; page < 80; page++) {
    const path: string = cursor
      ? `${base}/api/v1/marketplace/catalog?limit=1&cursor=${encodeURIComponent(cursor)}`
      : `${base}/api/v1/marketplace/catalog?limit=1`;
    const response: Response = await fetch(path);
    assert.equal(response.status, 200);
    const body = (await response.json()) as { items: { kind: string; id: string }[]; nextCursor: string | null };
    for (const item of body.items) {
      const key = `${item.kind}:${item.id}`;
      assert.equal(seen.has(key), false, key);
      seen.add(key);
    }
    if (!body.nextCursor) break;
    cursor = body.nextCursor;
  }
  for (const id of ['A', 'a', 'b', 'a-b', 'a_b', 'ab']) {
    assert.equal(seen.has(`product:${id}`), true, id);
  }

  const unnamed = await prisma.product.create({
    data: {
      partnerId: partner.id,
      nameAr: 'فستان بدون تصنيف',
      nameEn: 'Dress',
      priceHalalas: 0,
      externalUrl: 'https://example.com',
      concernTags: [],
      skinTypes: [],
      active: true,
      category: null,
    },
  });
  const unnamedDetail = await fetch(`${base}/api/v1/marketplace/catalog/product/${unnamed.id}`);
  const unnamedBody = (await unnamedDetail.json()) as { category: string | null; priceHalalas: number };
  assert.equal(unnamedBody.category, null);
  assert.equal(unnamedBody.priceHalalas, 0);
  assert.ok(catalogBody.items.length > 0);

  await app.close();
  await prisma.$disconnect();
  console.log('marketplace http integration passed');
  console.log('Firebase verifier in this run is a test double and does not prove a live Firebase connection');
}

async function postFavorite(base: string, token: string, body: { kind: string; id: string; saved: boolean }) {
  return fetch(`${base}/api/v1/marketplace/favorites`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function baseUrl(app: INestApplication): Promise<string> {
  const address = app.getHttpServer().address();
  if (address == null || typeof address === 'string') throw new Error('no port');
  return `http://127.0.0.1:${address.port}`;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
