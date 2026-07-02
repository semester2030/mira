import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  MceContextSnapshotV1,
  MceFactEntry,
} from '../contracts/mce-context-snapshot.v1';
import { GroundingResult } from './mce-grounding-pipeline.service';

@Injectable()
export class MceContextSnapshotService {
  constructor(private readonly prisma: PrismaService) {}

  async createVersion(
    sessionId: string,
    version: number,
    grounding: GroundingResult,
  ): Promise<string> {
    const row = await this.prisma.consultationContextSnapshot.create({
      data: {
        sessionId,
        version,
        skinAnalysisId: grounding.skinAnalysisId,
        outfitAnalysisId: grounding.outfitAnalysisId,
        recolorAttemptId: grounding.recolorAttemptId,
        snapshotJson: grounding.snapshot as object,
        factRegistryJson: grounding.factRegistry as object[],
        contentHash: grounding.contentHash,
      },
    });
    return row.id;
  }

  async loadForSession(
    sessionId: string,
    snapshotId?: string,
  ): Promise<{
    id: string;
    snapshot: MceContextSnapshotV1;
    factRegistry: MceFactEntry[];
  }> {
    const row = snapshotId
      ? await this.prisma.consultationContextSnapshot.findFirst({
          where: { id: snapshotId, sessionId },
        })
      : await this.prisma.consultationContextSnapshot.findFirst({
          where: { sessionId },
          orderBy: { version: 'desc' },
        });

    if (!row) {
      throw new Error('لا توجد لقطة سياق للجلسة');
    }

    return {
      id: row.id,
      snapshot: row.snapshotJson as unknown as MceContextSnapshotV1,
      factRegistry: row.factRegistryJson as unknown as MceFactEntry[],
    };
  }
}
