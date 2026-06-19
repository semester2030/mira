import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { PartnersPortalService } from '../partners-portal/partners-portal.service';
import { UsersService } from '../users/users.service';

describe('AdminService', () => {
  let service: AdminService;

  const prisma = {
    user: { count: jest.fn().mockResolvedValue(10) },
    skinAnalysis: { count: jest.fn().mockResolvedValue(2), findMany: jest.fn().mockResolvedValue([]) },
    outfitAnalysis: { count: jest.fn().mockResolvedValue(1), findMany: jest.fn().mockResolvedValue([]) },
    recommendation: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    auditLog: { count: jest.fn().mockResolvedValue(5), groupBy: jest.fn().mockResolvedValue([]) },
    subscription: { count: jest.fn().mockResolvedValue(3) },
    partnerApplication: { count: jest.fn().mockResolvedValue(1) },
    feedback: { count: jest.fn().mockResolvedValue(4) },
    partner: { count: jest.fn().mockResolvedValue(2) },
    websiteLead: { count: jest.fn().mockResolvedValue(6) },
    partnerEvent: { count: jest.fn().mockResolvedValue(12) },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string, def?: string) => def) },
        },
        {
          provide: UsersService,
          useValue: { writeAuditLog: jest.fn() },
        },
        {
          provide: PartnersPortalService,
          useValue: {
            listApplications: jest.fn(),
            approveApplication: jest.fn(),
            rejectApplication: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AdminService);
    jest.clearAllMocks();
  });

  it('returns overview stats shape', async () => {
    const stats = await service.getOverviewStats();
    expect(stats.users.total).toBe(10);
    expect(stats.analyses.skinToday).toBe(2);
    expect(stats.partners.pendingApplications).toBe(1);
  });
});
