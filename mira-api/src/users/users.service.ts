import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateFromFirebase(authUser: RequestUser): Promise<User> {
    const existing = await this.prisma.user.findUnique({
      where: { firebaseUid: authUser.firebaseUid },
    });

    if (existing) {
      if (
        authUser.email &&
        authUser.email !== existing.email
      ) {
        return this.prisma.user.update({
          where: { id: existing.id },
          data: {
            email: authUser.email,
            displayName: authUser.name ?? existing.displayName,
          },
        });
      }
      return existing;
    }

    return this.prisma.user.create({
      data: {
        firebaseUid: authUser.firebaseUid,
        email: authUser.email,
        displayName: authUser.name,
        subscription: {
          create: { plan: 'free', status: 'active' },
        },
        preference: {
          create: { locale: 'ar' },
        },
      },
    });
  }

  async getByFirebaseUid(firebaseUid: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { firebaseUid } });
  }

  async writeAuditLog(params: {
    userId?: string;
    action: string;
    metadata?: Prisma.InputJsonValue;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        metadata: params.metadata,
      },
    });
  }
}
