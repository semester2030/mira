import { ConfigService } from '@nestjs/config';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  } as unknown as PrismaService;

  const config = {
    get: jest.fn((key: string) => {
      if (key === 'AUTH_SKIP') return 'true';
      return undefined;
    }),
  } as unknown as ConfigService;

  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(prisma, config);
  });

  it('deletes user row and writes audit when account exists', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'u1',
      email: 'a@test.com',
    });

    await service.deleteAccount({ firebaseUid: 'fb-1', email: 'a@test.com' });

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'account_deleted', userId: 'u1' }),
      }),
    );
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
  });

  it('no-ops when user not found', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    await service.deleteAccount({ firebaseUid: 'missing' });

    expect(prisma.user.delete).not.toHaveBeenCalled();
  });
});
