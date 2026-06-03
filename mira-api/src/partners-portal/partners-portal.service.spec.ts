import { ConfigService } from '@nestjs/config';
import { PartnersPortalService } from './partners-portal.service';

describe('PartnersPortalService', () => {
  const prisma = {
    partnerApplication: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    partner: { create: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn() },
    partnerUser: { create: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn() },
    partnerEvent: { create: jest.fn(), groupBy: jest.fn() },
    product: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    service: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  };

  const config = {
    get: jest.fn().mockReturnValue('false'),
  } as unknown as ConfigService;

  let service: PartnersPortalService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PartnersPortalService(prisma as never, config);
  });

  it('creates pending application when auto-approve is off', async () => {
    prisma.partnerApplication.findFirst.mockResolvedValue(null);
    prisma.partnerApplication.create.mockResolvedValue({
      id: 'app-1',
      status: 'pending',
      statusToken: 'tok-abc',
    });

    const result = await service.apply({
      type: 'brand',
      nameAr: 'ماركة',
      nameEn: 'Brand',
      contactName: 'Sara',
      contactEmail: 's@t.com',
      contactPhone: '0500000000',
    });

    expect(result.status).toBe('pending');
    expect(result.statusToken).toBe('tok-abc');
    expect(prisma.partnerApplication.create).toHaveBeenCalled();
  });

  it('approve creates partner and user in transaction', async () => {
    prisma.partnerApplication.findUnique.mockResolvedValue({
      id: 'app-1',
      status: 'pending',
      type: 'brand',
      nameAr: 'ماركة',
      nameEn: 'Brand',
      contactEmail: 's@t.com',
      city: 'الرياض',
      descriptionAr: null,
      storeUrl: null,
    });

    prisma.$transaction.mockImplementation(async (fn) =>
      fn({
        partner: {
          create: jest.fn().mockResolvedValue({ id: 'partner-1' }),
        },
        partnerUser: { create: jest.fn().mockResolvedValue({}) },
        partnerApplication: { update: jest.fn().mockResolvedValue({}) },
      }),
    );

    const result = await service.approveApplication('app-1');
    expect(result.partnerId).toBe('partner-1');
    expect(result.accessToken).toBeDefined();
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
