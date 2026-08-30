import assert from 'node:assert/strict';
import { ForbiddenException, NotImplementedException } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { PartnersPortalService } from '../partners-portal/partners-portal.service';
import { assertProductionIntegrity } from '../config/production-integrity';

async function run() {
  assert.throws(() =>
    assertProductionIntegrity({
      NODE_ENV: 'production',
      AUTH_SKIP: 'true',
      PERFECT_CORP_FALLBACK_MOCK: 'false',
      SKIN_PROVIDER: 'perfect_corp',
    }),
  );
  assert.throws(() =>
    assertProductionIntegrity({
      NODE_ENV: 'production',
      PARTNER_AUTO_APPROVE: 'true',
      PERFECT_CORP_FALLBACK_MOCK: 'false',
      SKIN_PROVIDER: 'perfect_corp',
    }),
  );

  let userLookupCount = 0;
  let subscriptionUpdateCount = 0;
  const subscriptions = new SubscriptionsService(
    {
      subscription: {
        update: async () => {
          subscriptionUpdateCount += 1;
        },
      },
    } as never,
    {
      findOrCreateFromFirebase: async () => {
        userLookupCount += 1;
        return { id: 'user-1' };
      },
    } as never,
    { get: () => 'production' } as never,
  );

  assert.throws(
    () =>
      (
        subscriptions.handleStoreWebhook as unknown as (
          body: unknown,
        ) => never
      )({ event: 'forged-premium' }),
    NotImplementedException,
  );
  await assert.rejects(
    subscriptions.activatePremiumDev({
      firebaseUid: 'uid',
    }),
    ForbiddenException,
  );
  assert.equal(userLookupCount, 0);
  assert.equal(subscriptionUpdateCount, 0);

  const publicApplication = {
    status: 'approved',
    type: 'brand',
    nameAr: 'ماركة',
    rejectReason: null,
    reviewedAt: new Date('2026-08-30T00:00:00.000Z'),
    partnerId: 'partner-1',
    contactEmail: 'owner@example.com',
    partner: { users: [{ accessToken: 'must-not-leak' }] },
  };
  const partners = new PartnersPortalService(
    {
      partnerApplication: {
        findUnique: async () => publicApplication,
      },
    } as never,
    { get: () => 'false' } as never,
  );
  const status = await partners.getApplicationStatus('public-status-token');
  assert.equal('accessToken' in status, false);
  assert.equal(JSON.stringify(status).includes('must-not-leak'), false);

  console.log('phase_prod_closure1_commerce_security: PASS');
}

void run();
