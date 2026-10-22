import {
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const STALE_MS = 3 * 60 * 1000;

export type SkinClaimOpen =
  | { status: 'created'; claimId: string; attemptToken: string; chargeRateLimit: true }
  | {
      status: 'resume';
      claimId: string;
      attemptToken: string;
      chargeRateLimit: boolean;
      providerTaskId: string | null;
    }
  | { status: 'complete'; analysisId: string };

@Injectable()
export class SkinAnalysisClaimService {
  private readonly logger = new Logger(SkinAnalysisClaimService.name);

  constructor(private readonly prisma: PrismaService) {}

  fingerprint(imageBuffer: Buffer, faceIntelRaw?: unknown): string {
    const h = createHash('sha256');
    h.update(imageBuffer);
    if (faceIntelRaw != null) {
      h.update('|');
      h.update(
        typeof faceIntelRaw === 'string'
          ? faceIntelRaw
          : JSON.stringify(faceIntelRaw),
      );
    }
    return h.digest('hex');
  }

  async open(input: {
    userId: string;
    clientRequestId: string;
    inputFingerprint: string;
  }): Promise<SkinClaimOpen> {
    const attemptToken = randomUUID();
    const attemptExpiresAt = new Date(Date.now() + STALE_MS);
    try {
      const created = await this.prisma.skinAnalysisClaim.create({
        data: {
          userId: input.userId,
          clientRequestId: input.clientRequestId,
          inputFingerprint: input.inputFingerprint,
          status: 'pending',
          attemptToken,
          attemptExpiresAt,
          rateLimitCharged: false,
        },
      });
      return {
        status: 'created',
        claimId: created.id,
        attemptToken,
        chargeRateLimit: true,
      };
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      ) {
        throw error;
      }
    }

    const existing = await this.prisma.skinAnalysisClaim.findUnique({
      where: {
        userId_clientRequestId: {
          userId: input.userId,
          clientRequestId: input.clientRequestId,
        },
      },
    });
    if (!existing) {
      throw new ConflictException({
        code: 'SKIN_CLAIM_RACE',
        message: 'تعذر استئناف التحليل — أعيدي المحاولة.',
      });
    }
    if (existing.inputFingerprint !== input.inputFingerprint) {
      throw new ConflictException({
        code: 'SKIN_CLIENT_REQUEST_CONFLICT',
        message: 'معرّف الطلب مستخدم بصورة مختلفة. التقطي صورة جديدة.',
      });
    }
    if (existing.status === 'complete' && existing.analysisId) {
      return { status: 'complete', analysisId: existing.analysisId };
    }

    const now = new Date();
    const leaseDead =
      !existing.attemptExpiresAt || existing.attemptExpiresAt < now;
    const canResume =
      existing.status === 'failed' ||
      (existing.status === 'pending' && leaseDead);

    if (!canResume) {
      throw new ConflictException({
        code: 'SKIN_ANALYSIS_IN_PROGRESS',
        message: 'الطلب نفسه ما زال قيد المعالجة.',
      });
    }

    const nextToken = randomUUID();
    const updated = await this.prisma.skinAnalysisClaim.updateMany({
      where: {
        id: existing.id,
        OR: [
          { status: 'failed' },
          { status: 'pending', attemptExpiresAt: { lt: now } },
        ],
      },
      data: {
        status: 'pending',
        attemptToken: nextToken,
        attemptExpiresAt: new Date(now.getTime() + STALE_MS),
        errorCode: null,
      },
    });
    if (updated.count !== 1) {
      throw new ConflictException({
        code: 'SKIN_ANALYSIS_IN_PROGRESS',
        message: 'الطلب نفسه ما زال قيد المعالجة.',
      });
    }
    this.logger.log(
      `skin-claim resume id=${existing.id} charged=${existing.rateLimitCharged}`,
    );
    return {
      status: 'resume',
      claimId: existing.id,
      attemptToken: nextToken,
      chargeRateLimit: existing.rateLimitCharged !== true,
      providerTaskId: existing.providerTaskId,
    };
  }

  async markRateLimitCharged(claimId: string): Promise<void> {
    await this.prisma.skinAnalysisClaim.update({
      where: { id: claimId },
      data: { rateLimitCharged: true },
    });
  }

  async markProviderTask(
    claimId: string,
    providerTaskId: string,
  ): Promise<void> {
    await this.prisma.skinAnalysisClaim.update({
      where: { id: claimId },
      data: { providerTaskId },
    });
  }

  async markComplete(claimId: string, analysisId: string): Promise<void> {
    await this.prisma.skinAnalysisClaim.update({
      where: { id: claimId },
      data: {
        status: 'complete',
        analysisId,
        attemptToken: null,
        attemptExpiresAt: null,
        errorCode: null,
      },
    });
  }

  async markFailed(claimId: string, errorCode?: string): Promise<void> {
    await this.prisma.skinAnalysisClaim.update({
      where: { id: claimId },
      data: {
        status: 'failed',
        attemptToken: null,
        attemptExpiresAt: null,
        errorCode: errorCode ?? 'failed',
      },
    });
  }
}
