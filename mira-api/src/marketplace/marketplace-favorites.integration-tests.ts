import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { MarketplaceService } from './marketplace.service';
import { PrismaService } from '../prisma/prisma.service';

const url = process.env.DATABASE_URL ?? '';
const local = url.includes('localhost') || url.includes('127.0.0.1');

async function main() {
  if (!url || !local) {
    console.error('NOT_RUN marketplace favorites integration: DATABASE_URL is not a local test database');
    process.exit(2);
  }
  const prisma = new PrismaClient();
  const prismaService = { ...prisma, onModuleInit: async () => {} } as unknown as PrismaService;
  const service = new MarketplaceService(prismaService);
  await service.onModuleInit();
  const uidA = `test-a-${Date.now()}`;
  const uidB = `test-b-${Date.now()}`;
  const userA = await prisma.user.create({ data: { firebaseUid: uidA, email: 'a@test.local' } });
  const userB = await prisma.user.create({ data: { firebaseUid: uidB, email: 'b@test.local' } });
  const partner = await prisma.partner.findFirst({ where: { status: 'active' } });
  assert.ok(partner, 'seed partner required');
  const product = await prisma.product.findFirst({ where: { active: true, partnerId: partner.id } });
  assert.ok(product, 'seed product required');
  await service.setFavorite(uidA, 'product', product.id, true);
  await service.setFavorite(uidA, 'product', product.id, true);
  const aList = await service.listFavorites(uidA);
  const bList = await service.listFavorites(uidB);
  assert.equal(aList.items.some((item) => item.kind === 'product' && item.id === product.id), true);
  assert.equal(bList.items.length, 0);
  await prisma.catalogFavorite.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
  await prisma.$disconnect();
  console.log('marketplace favorites integration passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
