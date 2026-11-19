import { createHash } from 'node:crypto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { extractMiraReportFromStored } from '../../skin-analysis/dto/skin-analysis-response.dto';
import { resolveFaceSelection, sanitizeFaceSelection } from './consultation-face-selection';
import { CreateConsultationSessionDto } from '../dto/create-session.dto';
import { UpdateConsultationContextDto } from '../dto/update-session-context.dto';
import { ConsultationSessionResponseDto } from '../dto/consultation-response.dto';
import { MceContextSnapshotV1, MceFactEntry } from '../contracts/mce-context-snapshot.v1';
import { marketplaceOfferFacts } from './consultation-scope';
import { publicProductCommerce } from '../../marketplace/commerce-public';
import { MceGroundingPipelineService } from './mce-grounding-pipeline.service';
import { MceContextSnapshotService } from './mce-context-snapshot.service';

const STARTERS_OPEN = [
  'عندي مناسبة',
  'عن بشرتي',
  'أبحث بصورة',
  'أبي خدمة',
];

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

const STARTERS_SERVICE_OFFER = [
  'وش تشمل الجلسة؟',
  'كم مدة الجلسة؟',
  'وين تكون الجلسة؟',
  'هل أقدر أحجز أكثر من خدمة؟',
];

const STARTERS_PRODUCT_OFFER = [
  'وش يحتوي المنتج؟',
  'ما المقاس أو الحجم المتاح؟',
  'كيف أطلبه؟',
  'هل في سياسة استرجاع؟',
];

export function pickSuggestedStarters(snapshot?: {
  skin?: unknown;
  outfit?: unknown;
  atelier?: unknown;
  marketplaceOfferId?: string;
  marketplaceOfferKind?: string;
}): string[] {
  if (snapshot?.marketplaceOfferId) {
    return snapshot.marketplaceOfferKind === 'product'
      ? STARTERS_PRODUCT_OFFER
      : STARTERS_SERVICE_OFFER;
  }
  if (snapshot?.atelier && !snapshot?.skin && !snapshot?.outfit) return STARTERS_ATELIER;
  if (snapshot?.skin && snapshot?.outfit) return STARTERS_FUSION;
  if (snapshot?.outfit) return STARTERS_OUTFIT;
  if (snapshot?.skin) return STARTERS_SKIN;
  return STARTERS_OPEN;
}

function sessionTitle(snapshot: MceContextSnapshotV1): string {
  if (snapshot.atelier && !snapshot.skin && !snapshot.outfit) {
    return `استشارة Atelier — ${snapshot.atelier.garmentLabelAr}`;
  }
  if (snapshot.outfit && snapshot.skin) {
    return `استشارة شاملة — ${snapshot.outfit.styleTypeAr}`;
  }
  if (snapshot.outfit) {
    const score = snapshot.outfit.compatibilityScore;
    return score == null
      ? `استشارة إطلالة — ${snapshot.outfit.styleTypeAr}`
      : `استشارة إطلالة — ${snapshot.outfit.styleTypeAr} · ${score}%`;
  }
  if (snapshot.skin) {
    return `استشارة بشرة — ${snapshot.skin.skinTypeAr}`;
  }
  return 'استشارة ميرا';
}

@Injectable()
export class ConsultationSessionService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MceGroundingPipelineService) private readonly grounding: MceGroundingPipelineService,
    @Inject(MceContextSnapshotService) private readonly snapshots: MceContextSnapshotService,
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
    if (dto.face) {
      const reportId = dto.face.reportRef || dto.skinAnalysisId;
      const row = reportId
        ? await this.prisma.skinAnalysis.findFirst({ where: { id: reportId, userId } })
        : null;
      const stored = row ? extractMiraReportFromStored(row.resultJson) : null;
      const resolved = resolveFaceSelection({
        owned: Boolean(row),
        report: stored?.faceIntelligence ?? null,
        focus: dto.face,
      });
      grounding.snapshot.faceSelection = resolved.selection;
      grounding.factRegistry.push(...resolved.facts);
      grounding.contentHash = createHash('sha256').update(JSON.stringify(grounding.snapshot)).digest('hex').slice(0, 32);
    }

    let marketplaceMeta: {
      marketplaceOfferId: string;
      marketplaceOfferKind: 'product' | 'service';
      marketplaceOfferTitleAr?: string;
    } | null = null;
    if (dto.marketplaceOfferId) {
      const offerFacts = await this.loadMarketplaceOfferFacts(
        dto.marketplaceOfferId,
        dto.marketplaceOfferKind ?? 'service',
      );
      if (offerFacts) {
        grounding.factRegistry.push(...offerFacts.facts);
        const snap = grounding.snapshot as MceContextSnapshotV1 & {
          marketplaceOfferId?: string;
          marketplaceOfferKind?: string;
        };
        snap.marketplaceOfferId = offerFacts.meta.marketplaceOfferId;
        snap.marketplaceOfferKind = offerFacts.meta.marketplaceOfferKind;
        marketplaceMeta = offerFacts.meta;
        grounding.contentHash = createHash('sha256')
          .update(JSON.stringify(grounding.snapshot))
          .digest('hex')
          .slice(0, 32);
      }
    }

    const session = await this.prisma.consultationSession.create({
      data: {
        userId,
        locale,
        occasionId: dto.occasionId ?? grounding.snapshot.occasionId,
        planTier,
        titleAr: marketplaceMeta?.marketplaceOfferTitleAr
          ? `استشارة عرض — ${marketplaceMeta.marketplaceOfferTitleAr}`
          : sessionTitle(grounding.snapshot),
        metadataJson: {
          ...(dto.statedGoalAr ? { statedGoalAr: dto.statedGoalAr } : {}),
          ...(dto.face ? { faceSelection: sanitizeFaceSelection(dto.face) } : {}),
          ...(marketplaceMeta ?? {}),
        } as Prisma.InputJsonValue,
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
    // Discussion occasion/focus updates the snapshot only — report occasion stays on the outfit row.
    const occasionId = dto.occasionId ?? session.occasionId ?? undefined;
    const priorGoal =
      active?.snapshotJson && typeof active.snapshotJson === 'object' && !Array.isArray(active.snapshotJson)
        ? (active.snapshotJson as { user?: { statedGoalAr?: string } }).user?.statedGoalAr
        : undefined;
    const statedGoalAr = dto.statedGoalAr ?? priorGoal;

    const meta =
      session.metadataJson && typeof session.metadataJson === 'object' && !Array.isArray(session.metadataJson)
        ? ({ ...(session.metadataJson as Record<string, unknown>) } as Record<string, unknown>)
        : {};
    const appliedOps = Array.isArray(meta.appliedPreferenceOpIds)
      ? (meta.appliedPreferenceOpIds as string[])
      : [];
    const opId = dto.clientPreferenceOpId?.trim() || '';
    const alreadyApplied = opId.length > 0 && appliedOps.includes(opId);

    // Idempotent: same clientPreferenceOpId does not rebuild the snapshot again.
    if (alreadyApplied) {
      const dtoOut = this.toDto(session, undefined);
      dtoOut.appliedPreferenceOpId = opId;
      return dtoOut;
    }

    const grounding = await this.grounding.build({
      userId,
      skinAnalysisId,
      outfitAnalysisId,
      recolorAttemptId,
      locale: session.locale,
      birthYear,
      subscriptionPlan: planTier,
      occasionId,
      statedGoalAr,
    });

    const version =
      (await this.prisma.consultationContextSnapshot.count({ where: { sessionId } })) + 1;
    const snapshotId = await this.snapshots.createVersion(sessionId, version, grounding);

    if (opId) {
      appliedOps.push(opId);
      meta.appliedPreferenceOpIds = appliedOps.slice(-50);
    }

    const updated = await this.prisma.consultationSession.update({
      where: { id: sessionId },
      data: {
        activeSnapshotId: snapshotId,
        occasionId: occasionId ?? session.occasionId,
        titleAr: sessionTitle(grounding.snapshot),
        updatedAt: new Date(),
        ...(opId
          ? {
              metadataJson: meta as import('@prisma/client').Prisma.InputJsonValue,
            }
          : {}),
      },
    });

    const dtoOut = this.toDto(updated, grounding.snapshot);
    if (opId) dtoOut.appliedPreferenceOpId = opId;
    return dtoOut;
  }

  async getForUser(userId: string, sessionId: string) {
    const row = await this.prisma.consultationSession.findFirst({
      where: { id: sessionId, userId, status: { not: 'deleted' } },
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

  private async loadMarketplaceOfferFacts(
    offerId: string,
    kind: 'product' | 'service',
  ): Promise<{
    facts: MceFactEntry[];
    meta: {
      marketplaceOfferId: string;
      marketplaceOfferKind: 'product' | 'service';
      marketplaceOfferTitleAr?: string;
    };
  } | null> {
    if (kind === 'product') {
      const product = await this.prisma.product.findFirst({
        where: {
          id: offerId,
          active: true,
          contentStatus: 'published',
          catalogSource: 'catalog',
          partner: { status: 'active' },
        },
        include: { partner: true },
      });
      if (!product) return null;
      const commerce = publicProductCommerce(product);
      // Never claim in-stock when quantity is untracked (stockAvailable true-by-default means unknown).
      const availability =
        product.stockQty == null ? null : commerce.stockAvailable === true;
      return {
        facts: marketplaceOfferFacts({
          id: product.id,
          kind: 'product',
          nameAr: product.nameAr,
          descriptionAr: product.descriptionAr,
          priceHalalas: product.priceHalalas,
          availability,
          partnerNameAr: product.partner.nameAr,
        }) as MceFactEntry[],
        meta: {
          marketplaceOfferId: product.id,
          marketplaceOfferKind: 'product',
          marketplaceOfferTitleAr: product.nameAr,
        },
      };
    }
    const service = await this.prisma.service.findFirst({
      where: {
        id: offerId,
        active: true,
        contentStatus: 'published',
        catalogSource: 'catalog',
        partner: { status: 'active' },
      },
      include: { partner: true },
    });
    if (!service) return null;
    return {
      facts: marketplaceOfferFacts({
        id: service.id,
        kind: 'service',
        nameAr: service.nameAr,
        descriptionAr: service.descriptionAr,
        priceHalalas: service.priceHalalas,
        availability: service.bookingEnabled,
        durationMin: service.durationMin,
        partnerNameAr: service.partner.nameAr,
      }) as MceFactEntry[],
      meta: {
        marketplaceOfferId: service.id,
        marketplaceOfferKind: 'service',
        marketplaceOfferTitleAr: service.nameAr,
      },
    };
  }

  /** Live re-read of the open offer so description/pause edits apply mid-chat. */
  async refreshMarketplaceOfferFacts(session: {
    metadataJson?: unknown;
  }): Promise<MceFactEntry[] | null> {
    const meta =
      session.metadataJson && typeof session.metadataJson === 'object' && !Array.isArray(session.metadataJson)
        ? (session.metadataJson as Record<string, unknown>)
        : null;
    const offerId = typeof meta?.marketplaceOfferId === 'string' ? meta.marketplaceOfferId : '';
    if (!offerId) return null;
    const kind = meta?.marketplaceOfferKind === 'product' ? 'product' : 'service';
    const loaded = await this.loadMarketplaceOfferFacts(offerId, kind);
    return loaded?.facts ?? null;
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
    snapshot?: MceContextSnapshotV1 & { marketplaceOfferId?: string },
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
