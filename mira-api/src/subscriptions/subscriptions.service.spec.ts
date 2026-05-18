import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubscriptionsService } from './subscriptions.service';
import { SUBSCRIPTION_PLANS } from './subscription-plans';

describe('SubscriptionsService', () => {
  const authUser = { uid: 'firebase-uid', email: 'a@test.com' };

  const usersService = {
    findOrCreateFromFirebase: jest.fn().mockResolvedValue({ id: 'user-1' }),
  };

  const prisma = {
    subscription: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    skinAnalysis: { count: jest.fn() },
    outfitAnalysis: { count: jest.fn() },
  };

  const config = {
    get: jest.fn().mockReturnValue('development'),
  } as unknown as ConfigService;

  let service: SubscriptionsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SubscriptionsService(
      prisma as never,
      usersService as never,
      config,
    );
  });

  it('throws when free tier skin limit reached', async () => {
    prisma.subscription.findUnique.mockResolvedValue({
      userId: 'user-1',
      plan: SUBSCRIPTION_PLANS.free,
      status: 'active',
    });
    prisma.skinAnalysis.count.mockResolvedValue(3);
    prisma.outfitAnalysis.count.mockResolvedValue(0);

    await expect(service.assertCanAnalyze(authUser, 'skin')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows premium users', async () => {
    prisma.subscription.findUnique.mockResolvedValue({
      userId: 'user-1',
      plan: SUBSCRIPTION_PLANS.premium,
      status: 'active',
    });

    await expect(service.assertCanAnalyze(authUser, 'skin')).resolves.toBeUndefined();
  });
});
