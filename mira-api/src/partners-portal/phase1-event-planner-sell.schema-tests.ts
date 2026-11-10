/**
 * Phase1 corrective: event_planner sell capability is Partner.canSellProducts only.
 * storeUrl must never grant product create. Exercises createProduct/createService gates.
 */
import assert from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PartnersPortalService } from './partners-portal.service';
import {
  partnerCanCreateKindFromPartner,
  partnerCanSellProducts,
} from './partner-capabilities';

async function main() {
  assert.equal(
    partnerCanSellProducts({ type: 'event_planner', canSellProducts: true, storeUrl: null }),
    true,
  );
  assert.equal(
    partnerCanSellProducts({
      type: 'event_planner',
      canSellProducts: false,
      storeUrl: 'mira:canSellProducts=1',
    }),
    false,
    'storeUrl marker must not grant sell',
  );
  assert.equal(
    partnerCanCreateKindFromPartner(
      { type: 'event_planner', canSellProducts: false, storeUrl: 'mira:canSellProducts=1' },
      'product',
    ),
    false,
  );
  assert.equal(
    partnerCanCreateKindFromPartner({ type: 'event_planner', canSellProducts: true }, 'product'),
    true,
  );
  assert.equal(
    partnerCanCreateKindFromPartner({ type: 'event_planner', canSellProducts: false }, 'service'),
    true,
  );

  const prisma: any = {
    partner: { findUnique: async () => null },
    product: { create: async ({ data }: any) => data },
    service: { create: async ({ data }: any) => data },
  };
  const config = { get: () => 'false' } as unknown as ConfigService;
  const service = new PartnersPortalService(prisma, config);

  async function expectForbidden(fn: () => Promise<unknown>) {
    try {
      await fn();
      assert.fail('expected ForbiddenException');
    } catch (e) {
      assert.ok(e instanceof ForbiddenException);
    }
  }

  // Service allowed without sell flag.
  prisma.partner.findUnique = async () => ({
    id: 'ep-1',
    type: 'event_planner',
    canSellProducts: false,
    storeUrl: 'https://shop.example',
  });
  {
    try {
      await service.createService('ep-1', { nameAr: 'تنسيق', durationMin: 60 } as any);
    } catch (e) {
      assert.ok(!(e instanceof ForbiddenException), 'service must not be forbidden for event_planner');
    }
  }

  // Product rejected before grant (storeUrl marker ignored).
  prisma.partner.findUnique = async () => ({
    id: 'ep-1',
    type: 'event_planner',
    canSellProducts: false,
    storeUrl: 'mira:canSellProducts=1',
  });
  await expectForbidden(() =>
    service.createProduct('ep-1', { nameAr: 'توزيعات', priceHalalas: 1000 } as any),
  );

  // Product allowed after grant.
  prisma.partner.findUnique = async () => ({
    id: 'ep-1',
    type: 'event_planner',
    canSellProducts: true,
    storeUrl: null,
  });
  {
    try {
      await service.createProduct('ep-1', { nameAr: 'توزيعات', priceHalalas: 1000 } as any);
    } catch (e) {
      assert.ok(!(e instanceof ForbiddenException), 'product must be allowed after canSellProducts=true');
    }
  }

  // Revoke → reject again; changing storeUrl alone does nothing.
  prisma.partner.findUnique = async () => ({
    id: 'ep-1',
    type: 'event_planner',
    canSellProducts: false,
    storeUrl: 'https://now-selling.example',
  });
  await expectForbidden(() =>
    service.createProduct('ep-1', { nameAr: 'توزيعات', priceHalalas: 1000 } as any),
  );

  // Other accounts unchanged.
  assert.equal(partnerCanCreateKindFromPartner({ type: 'brand', canSellProducts: false }, 'product'), true);
  assert.equal(partnerCanCreateKindFromPartner({ type: 'brand', canSellProducts: false }, 'service'), false);
  assert.equal(partnerCanCreateKindFromPartner({ type: 'salon', canSellProducts: true }, 'product'), false);
  assert.equal(partnerCanCreateKindFromPartner({ type: 'salon', canSellProducts: false }, 'service'), true);
  assert.equal(partnerCanCreateKindFromPartner({ type: 'developer', canSellProducts: false }, 'product'), true);
  assert.equal(partnerCanCreateKindFromPartner({ type: 'developer', canSellProducts: false }, 'service'), true);

  console.log(JSON.stringify({ ok: true, id: 'PHASE1_EVENT_PLANNER_SELL' }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
