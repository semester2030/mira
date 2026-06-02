import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, User } from '@prisma/client';
import * as admin from 'firebase-admin';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

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

  /** Permanently deletes the user row (cascade) and Firebase Auth account. */
  async deleteAccount(authUser: RequestUser): Promise<void> {
    const user = await this.getByFirebaseUid(authUser.firebaseUid);

    if (user) {
      await this.writeAuditLog({
        userId: user.id,
        action: 'account_deleted',
        metadata: { email: user.email ?? null },
      });
      await this.prisma.user.delete({ where: { id: user.id } });
    }

    if (this.config.get<string>('AUTH_SKIP') === 'true') {
      return;
    }

    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    if (!projectId) {
      this.logger.warn('FIREBASE_PROJECT_ID not set; skipped Firebase user deletion');
      return;
    }

    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId,
      });
    }

    try {
      await admin.auth().deleteUser(authUser.firebaseUid);
    } catch (err) {
      this.logger.warn(
        `Firebase deleteUser failed for ${authUser.firebaseUid}: ${String(err)}`,
      );
    }
  }
}
