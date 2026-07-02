import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { UsersService } from '../users/users.service';
import { GarmentRecolorResponse } from '../vision/recolor/fashn-garment-recolor.service';
import { QelEvaluation } from '../vision/qel/garment-qel.service';
import { GarmentRecolorVisionContext } from '../vision/qel/garment-recolor-context.types';
import { AtelierContextSummaryV1 } from '../consultation/contracts/mce-context-snapshot.v1';

@Injectable()
export class AtelierRecolorAttemptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async persistAccepted(
    authUser: RequestUser,
    result: GarmentRecolorResponse,
    visionContext?: GarmentRecolorVisionContext,
    outfitAnalysisId?: string,
  ) {
    const user = await this.users.findOrCreateFromFirebase(authUser);
    return this.createRow(user.id, {
      outfitAnalysisId,
      garmentLabelAr: result.garmentLabelAr,
      targetColorAr: result.targetColorAr,
      targetColorHex: result.targetColorHex,
      regionRole: visionContext?.regionRole,
      qelGate: 'accept',
      qel: result.qel,
      processingMs: result.processingMs,
      attemptNumber: result.attempt,
      visionContext,
    });
  }

  async persistRejected(
    authUser: RequestUser,
    input: {
      garmentLabelAr: string;
      targetColorAr: string;
      targetColorHex?: string;
      regionRole?: string;
      qel?: QelEvaluation;
      processingMs?: number;
      attemptNumber?: number;
      visionContext?: GarmentRecolorVisionContext;
      outfitAnalysisId?: string;
    },
  ) {
    const user = await this.users.findOrCreateFromFirebase(authUser);
    return this.createRow(user.id, {
      ...input,
      qelGate: 'rejected',
      qel: input.qel,
    });
  }

  private async createRow(
    userId: string,
    input: {
      outfitAnalysisId?: string;
      garmentLabelAr: string;
      targetColorAr: string;
      targetColorHex?: string;
      regionRole?: string;
      qelGate: 'accept' | 'rejected';
      qel?: QelEvaluation;
      processingMs?: number;
      attemptNumber?: number;
      visionContext?: GarmentRecolorVisionContext;
    },
  ) {
    const rejectReasonAr =
      input.qelGate === 'rejected' ? input.qel?.rejectReasons?.join(' · ') : undefined;

    const row = await this.prisma.atelierRecolorAttempt.create({
      data: {
        userId,
        outfitAnalysisId: input.outfitAnalysisId,
        garmentLabelAr: input.garmentLabelAr,
        targetColorAr: input.targetColorAr,
        targetColorHex: input.targetColorHex,
        regionRole: input.regionRole,
        qelGate: input.qelGate,
        qelScoresJson: input.qel
          ? ({
              weightedScore: input.qel.weightedScore,
              threshold: input.qel.threshold,
              identityScore: input.qel.subScores.identityScore,
              edgeScore: input.qel.subScores.edgeScore,
              materialScore: input.qel.subScores.materialScore,
              regionIntegrityScore: input.qel.subScores.regionIntegrityScore,
              colorConsistencyScore: input.qel.subScores.colorConsistencyScore,
              phase: input.qel.phase,
            } as Prisma.InputJsonValue)
          : undefined,
        rejectReasonAr,
        recolorScope: 'color_only',
        processingMs: input.processingMs,
        attemptNumber: input.attemptNumber ?? 1,
        metadataJson: input.visionContext
          ? ({ regionRole: input.visionContext.regionRole } as Prisma.InputJsonValue)
          : undefined,
      },
    });

    await this.users.writeAuditLog({
      userId,
      action: 'atelier.recolor_attempt',
      metadata: {
        attemptId: row.id,
        qelGate: input.qelGate,
        garmentLabelAr: input.garmentLabelAr,
        targetColorAr: input.targetColorAr,
        imageRetained: false,
      },
    });

    return row;
  }

  toSummary(row: {
    id: string;
    garmentLabelAr: string;
    targetColorAr: string;
    regionRole: string | null;
    qelGate: string;
    qelScoresJson: unknown;
    rejectReasonAr: string | null;
    recolorScope: string;
  }): AtelierContextSummaryV1 {
    const scores =
      row.qelScoresJson && typeof row.qelScoresJson === 'object'
        ? (row.qelScoresJson as Record<string, number>)
        : undefined;

    return {
      recolorAttemptId: row.id,
      garmentLabelAr: row.garmentLabelAr,
      targetColorAr: row.targetColorAr,
      regionRole: row.regionRole ?? undefined,
      qelGate: row.qelGate === 'accept' ? 'accept' : 'rejected',
      qelScores: scores,
      rejectReasonAr: row.rejectReasonAr ?? undefined,
      recolorScope: 'color_only',
    };
  }
}
