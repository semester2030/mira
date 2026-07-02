import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateConsultationSessionDto } from '../dto/create-session.dto';
import { UpdateConsultationContextDto } from '../dto/update-session-context.dto';
import { ConsultationSessionResponseDto } from '../dto/consultation-response.dto';
import { MceContextSnapshotV1 } from '../contracts/mce-context-snapshot.v1';
import { MceGroundingPipelineService } from './mce-grounding-pipeline.service';
import { MceContextSnapshotService } from './mce-context-snapshot.service';

const STARTERS_SKIN = [
  'لماذا درجة ترطيبي كذا؟',
  'ما أفضل خطوة في روتيني الصباحي؟',
  'كيف أحافظ على نتائج التحليل؟',
  'ما المنتجات الأنسب لبشرتي؟',
];

const STARTERS_OUTFIT = [
  'هل تناسب إطلالتي هذه المناسبة؟',
  'ما اللون الأنسب للحذاء أو الحقيبة؟',
  'كيف أرفع تناسق الألوان؟',
  'ما الإكسسوار الذي يكمل الإطلالة؟',
];

const STARTERS_FUSION = [
  'كيف أربط إطلالتي ببشرتي؟',
  'هل ألوان إطلالتي تناسب بشرتي؟',
  'ما الإكسسوار والمكياج الأنسب معاً؟',
  'ما خطوة واحدة لتحسين الإطلالة اليوم؟',
];

const STARTERS_ATELIER = [
  'لماذا نجح التلوين؟',
  'هل اللون دقيق مقارنة بالمطلوب؟',
  'هل مسّ التلوين وجهي أو بشرتي؟',
  'ماذا يعني رفض QEL؟',
];

export function pickSuggestedStarters(snapshot?: {
  skin?: unknown;
  outfit?: unknown;
  atelier?: unknown;
}): string[] {
  if (snapshot?.atelier && !snapshot?.skin && !snapshot?.outfit) return STARTERS_ATELIER;
  if (snapshot?.skin && snapshot?.outfit) return STARTERS_FUSION;
  if (snapshot?.outfit) return STARTERS_OUTFIT;
  return STARTERS_SKIN;
}

function sessionTitle(snapshot: MceContextSnapshotV1): string {
  if (snapshot.atelier && !snapshot.skin && !snapshot.outfit) {
    return `استشارة Atelier — ${snapshot.atelier.garmentLabelAr}`;
  }
  if (snapshot.outfit && snapshot.skin) {
    return `استشارة شاملة — ${snapshot.outfit.styleTypeAr}`;
  }
  if (snapshot.outfit) {
    return `استشارة إطلالة — ${snapshot.outfit.styleTypeAr} · ${snapshot.outfit.compatibilityScore}%`;
  }
  if (snapshot.skin) {
    return `استشارة بشرة — ${snapshot.skin.skinTypeAr}`;
  }
  return 'استشارة ميرا';
}

@Injectable()
export class ConsultationSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly grounding: MceGroundingPipelineService,
    private readonly snapshots: MceContextSnapshotService,
  ) {}

  async create(
    userId: string,
    dto: CreateConsultationSessionDto,
    planTier: string,
    birthYear?: number | null,
  ): Promise<ConsultationSessionResponseDto> {
    const locale = dto.locale ?? 'ar';
    const grounding = await this.grounding.build({
      userId,
      skinAnalysisId: dto.skinAnalysisId,
      outfitAnalysisId: dto.outfitAnalysisId,
      recolorAttemptId: dto.recolorAttemptId,
      locale,
      birthYear,
      subscriptionPlan: planTier,
      statedGoalAr: dto.statedGoalAr,
      occasionId: dto.occasionId,
    });

    const session = await this.prisma.consultationSession.create({
      data: {
        userId,
        locale,
        occasionId: dto.occasionId ?? grounding.snapshot.occasionId,
        planTier,
        titleAr: sessionTitle(grounding.snapshot),
        metadataJson: dto.statedGoalAr ? { statedGoalAr: dto.statedGoalAr } : undefined,
      },
    });

    const snapshotId = await this.snapshots.createVersion(session.id, 1, grounding);

    const updated = await this.prisma.consultationSession.update({
      where: { id: session.id },
      data: { activeSnapshotId: snapshotId },
    });

    return this.toDto(updated, grounding.snapshot);
  }

  async bindContext(
    userId: string,
    sessionId: string,
    dto: UpdateConsultationContextDto,
    planTier: string,
    birthYear?: number | null,
  ): Promise<ConsultationSessionResponseDto> {
    const session = await this.getForUser(userId, sessionId);
    const active = session.activeSnapshotId
      ? await this.prisma.consultationContextSnapshot.findFirst({
          where: { id: session.activeSnapshotId, sessionId },
        })
      : null;

    const skinAnalysisId = dto.skinAnalysisId ?? active?.skinAnalysisId ?? undefined;
    const outfitAnalysisId = dto.outfitAnalysisId ?? active?.outfitAnalysisId ?? undefined;
    const recolorAttemptId = dto.recolorAttemptId ?? active?.recolorAttemptId ?? undefined;
    const occasionId = dto.occasionId ?? session.occasionId ?? undefined;

    const grounding = await this.grounding.build({
      userId,
      skinAnalysisId,
      outfitAnalysisId,
      recolorAttemptId,
      locale: session.locale,
      birthYear,
      subscriptionPlan: planTier,
      occasionId,
    });

    const version =
      (await this.prisma.consultationContextSnapshot.count({ where: { sessionId } })) + 1;
    const snapshotId = await this.snapshots.createVersion(sessionId, version, grounding);

    const updated = await this.prisma.consultationSession.update({
      where: { id: sessionId },
      data: {
        activeSnapshotId: snapshotId,
        occasionId: occasionId ?? session.occasionId,
        titleAr: sessionTitle(grounding.snapshot),
        updatedAt: new Date(),
      },
    });

    return this.toDto(updated, grounding.snapshot);
  }

  async getForUser(userId: string, sessionId: string) {
    const row = await this.prisma.consultationSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!row) throw new NotFoundException('الجلسة غير موجودة');
    return row;
  }

  async list(userId: string, limit = 20) {
    return this.prisma.consultationSession.findMany({
      where: { userId, status: { not: 'deleted' } },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  }

  toDto(
    row: {
      id: string;
      titleAr: string | null;
      status: string;
      activeSnapshotId: string | null;
      occasionId: string | null;
      turnCount: number;
      createdAt: Date;
      updatedAt: Date;
    },
    snapshot?: MceContextSnapshotV1,
  ): ConsultationSessionResponseDto {
    return {
      id: row.id,
      titleAr: row.titleAr,
      status: row.status,
      activeSnapshotId: row.activeSnapshotId,
      contextSummary: {
        hasSkin: Boolean(snapshot?.skin),
        hasOutfit: Boolean(snapshot?.outfit),
        hasRecolor: Boolean(snapshot?.atelier),
        occasionId: row.occasionId ?? snapshot?.occasionId ?? undefined,
      },
      turnCount: row.turnCount,
      suggestedStartersAr: pickSuggestedStarters(snapshot),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
