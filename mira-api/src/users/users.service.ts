import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, User, UserPreference } from '@prisma/client';
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

  async getPreferences(userId: string): Promise<UserPreference | null> {
    return this.prisma.userPreference.findUnique({ where: { userId } });
  }

  async updatePreferences(
    userId: string,
    data: { birthYear?: number | null; locale?: string },
  ): Promise<UserPreference> {
    if (data.birthYear !== undefined && data.birthYear !== null) {
      const year = Math.trunc(data.birthYear);
      const currentYear = new Date().getFullYear();
      if (year < 1920 || year > currentYear) {
        throw new BadRequestException('سنة الميلاد غير صالحة');
      }
    }

    return this.prisma.userPreference.upsert({
      where: { userId },
      create: {
        userId,
        locale: data.locale ?? 'ar',
        birthYear: data.birthYear ?? null,
      },
      update: {
        ...(data.locale !== undefined ? { locale: data.locale } : {}),
        ...(data.birthYear !== undefined ? { birthYear: data.birthYear } : {}),
      },
    });
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

    try {
      await this.deleteFirebaseUser(authUser.firebaseUid);
    } catch (err) {
      if (firebaseAuthErrorCode(err) === 'auth/user-not-found') {
        return;
      }
      this.logger.error(
        `Firebase identity deletion failed (${firebaseAuthErrorCode(err) ?? 'unknown'})`,
      );
      throw new ServiceUnavailableException({
        code: 'ACCOUNT_IDENTITY_DELETE_FAILED',
        message: 'Account identity deletion could not be completed safely.',
      });
    }
  }

  protected async deleteFirebaseUser(firebaseUid: string): Promise<void> {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    if (!projectId) {
      throw new Error('FIREBASE_PROJECT_ID_MISSING');
    }

    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId,
      });
    }

    await admin.auth().deleteUser(firebaseUid);
  }
}

function firebaseAuthErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}
