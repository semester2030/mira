import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { FullMiraAnalysisBodyDto } from './dto/full-mira-analysis-body.dto';
import { AnalyzeOutfitBodyDto } from '../outfit-analysis/dto/analyze-outfit.dto';
import { OutfitAnalysisService } from '../outfit-analysis/outfit-analysis.service';
import { SkinAnalysisService } from '../skin-analysis/skin-analysis.service';
import { PerfectHdMaskAcceptanceService } from './services/perfect-hd-mask-acceptance.service';
import { FullMiraAnalysisService } from './services/full-mira-analysis.service';
import { OutfitHybridIntelligenceService } from './services/outfit-hybrid-intelligence.service';
import { OutfitSegmentationService } from './segmentation/outfit-segmentation.service';
import { OutfitIntelligenceBodyDto } from './dto/outfit-intelligence-body.dto';
import { SkinReportSnapshot } from './contracts/outfit-intelligence.interface';
import { applyOutfitIntelligenceFashionBoundary } from '../fashion-knowledge/advisor-integration/outfit-intelligence-boundary';
import { VisionOrchestratorService } from '../vision/vision-orchestrator.service';
import { FashionAnalysisOrchestrator } from '../ports/orchestrators/fashion-analysis.orchestrator';
import { VisionOutfitAnalyzeBodyDto } from '../vision/dto/vision-outfit-analyze-body.dto';
import { VisionOutfitRecolorBodyDto } from '../vision/dto/vision-outfit-recolor-body.dto';
import { FashnGarmentRecolorService } from '../vision/recolor/fashn-garment-recolor.service';
import { GarmentRecolorVisionContext } from '../vision/qel/garment-recolor-context.types';
import { AtelierRecolorAttemptService } from '../atelier/atelier-recolor-attempt.service';
import { RateLimitService } from '../common/services/rate-limit.service';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * Public AI gateway — Flutter → Render → providers (Perfect Corp / Fashn).
 * Canonical production paths under global prefix (default `api/v1`):
 *   POST /api/v1/ai/skin-analysis
 *   POST /api/v1/ai/outfit-analysis
 */
@Controller('ai')
@UseGuards(FirebaseAuthGuard)
export class AiGatewayController {
  constructor(
    private readonly skinAnalysisService: SkinAnalysisService,
    private readonly perfectHdMaskAcceptance: PerfectHdMaskAcceptanceService,
    private readonly outfitAnalysisService: OutfitAnalysisService,
    private readonly fullMiraAnalysisService: FullMiraAnalysisService,
    private readonly outfitHybridIntelligenceService: OutfitHybridIntelligenceService,
    private readonly outfitSegmentationService: OutfitSegmentationService,
    private readonly visionOrchestrator: VisionOrchestratorService,
    private readonly fashionAnalysisOrchestrator: FashionAnalysisOrchestrator,
    private readonly fashnGarmentRecolorService: FashnGarmentRecolorService,
    private readonly atelierAttempts: AtelierRecolorAttemptService,
    private readonly rateLimit: RateLimitService,
  ) {}

  @Post('skin-analysis')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_BYTES },
    }),
  )
  analyzeSkin(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
    /**
     * Phase 4.5 — optional multipart field `faceIntel` (JSON string).
     * When absent/invalid, faceIntelligence sibling is omitted (never invented).
     */
    @Body() body?: { faceIntel?: string },
  ) {
    return this.skinAnalysisService.analyze(
      user,
      file?.buffer ?? Buffer.alloc(0),
      body?.faceIntel,
    );
  }

  /**
   * TECHNICAL ACCEPTANCE ONLY — Perfect HD detection masks.
   * Does not replace production skin-analysis. No History image/mask persistence.
   * POST /api/v1/ai/skin-analysis-hd-masks
   */
  @Post('skin-analysis-hd-masks')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_BYTES },
    }),
  )
  async analyzeSkinHdMasks(
    @CurrentUser() _user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const buf = file?.buffer ?? Buffer.alloc(0);
    try {
      const out = await this.perfectHdMaskAcceptance.runTechnicalAcceptance(buf);
      return {
        mode: 'hd_mask_technical_acceptance',
        legacyLandmarkMap: 'DEPRECATED_PENDING_OWNER_APPROVAL_FOR_SPATIAL',
        camerakit: 'NOT_AVAILABLE_IN_MIRA_REPO',
        retentionNoteAr:
          'نتائج Perfect المؤقتة (~24 ساعة) — لا تُحفظ صورة الوجه ولا الـmasks في History.',
        report: out.report,
        ephemeralMasks: out.ephemeralMasks,
        sourceImageBase64: out.sourceImageBase64,
        sourceContentType: out.sourceContentType,
      };
    } finally {
      if (buf.length) buf.fill(0);
    }
  }

  @Post('outfit-analysis')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_BYTES },
    }),
  )
  analyzeOutfit(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: AnalyzeOutfitBodyDto,
  ) {
    return this.outfitAnalysisService.analyze(
      user,
      file?.buffer ?? Buffer.alloc(0),
      body.occasion,
    );
  }

  /** Skin-linked hybrid outfit intelligence — Vision + LLM with server-side keys. */
  @Post('outfit-intelligence')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_BYTES },
    }),
  )
  async analyzeOutfitIntelligence(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: OutfitIntelligenceBodyDto,
  ) {
    const skin = JSON.parse(body.skinReport) as SkinReportSnapshot;
    const result = await this.outfitHybridIntelligenceService.analyze(
      file?.buffer ?? Buffer.alloc(0),
      body.occasion,
      skin,
    );
    // FK-12: strip user-facing prescriptive styling fields (analytical scores remain).
    return applyOutfitIntelligenceFashionBoundary({
      visual: result.visual as unknown as Record<string, unknown>,
      analysis: result.analysis as unknown as Record<string, unknown>,
    });
  }

  /** Pixel-refined garment contours — Vision bbox + server-side mask tracing. */
  @Post('outfit-segmentation')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_BYTES },
    }),
  )
  async analyzeOutfitSegmentation(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    await this.rateLimit.assertWithinLimit(
      user.firebaseUid,
      'fashion_segmentation',
    );
    return this.outfitSegmentationService.segment(file?.buffer ?? Buffer.alloc(0));
  }

  /**
   * Vision Platform — official outfit vision entry (Phase 2+).
   * Phase 1: routed through FashionAnalysisOrchestrator / FashionAnalysisPort.
   * Flutter must use this endpoint only — no client-side vision providers.
   */
  @Post('vision/outfit/analyze')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_BYTES },
    }),
  )
  async analyzeVisionOutfit(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: VisionOutfitAnalyzeBodyDto,
  ) {
    await this.rateLimit.assertWithinLimit(user.firebaseUid, 'fashion_analysis');
    let skinSnapshot: Record<string, unknown> | null = null;
    if (body.skinSnapshot?.trim()) {
      try {
        skinSnapshot = JSON.parse(body.skinSnapshot) as Record<string, unknown>;
      } catch {
        throw new BadRequestException({
          code: 'INVALID_SKIN_SNAPSHOT',
          message: 'skinSnapshot must be valid JSON',
        });
      }
    }

    const result = await this.fashionAnalysisOrchestrator.analyze({
      imageBytes: file?.buffer ?? Buffer.alloc(0),
      occasionId: body.occasionId,
      mode: body.mode,
      skinSnapshot,
      locale: body.locale ?? 'ar',
    });

    // Public contract (6C.1): CanonicalGarment only — no FashionVisionDocument on wire
    return {
      garments: result.garments,
      analysis: result.analysis,
      warnings: result.warnings,
      limitations: result.limitations,
      runtime: result.runtime,
      meta: {
        processingMs: result.processingMs,
        analysisGate: result.analysisGate,
        phase: 'ports-v1-canonical-garment',
        userMessageAr: result.userMessageAr,
        traceId: result.meta.traceId,
        calculationVersion: result.meta.calculationVersion,
        confidence: result.meta.confidence,
        // provider identity strings intentionally omitted from HTTP meta
      },
    };
  }

  /**
   * Garment recolor — FASHN Edit (Phase A).
   * Arabic prompt · server-side only · no image persistence.
   * Reference: docs/mira-garment-recolor.html
   */
  @Post('vision/outfit/recolor')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_BYTES },
    }),
  )
  async recolorVisionOutfit(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: VisionOutfitRecolorBodyDto,
  ) {
    await this.rateLimit.assertWithinLimit(user.firebaseUid, 'fashion_recolor');
    const visionContext = parseGarmentVisionContext(body.visionContext);
    return this.recolorAndPersist(user, file?.buffer ?? Buffer.alloc(0), body, visionContext);
  }

  private async recolorAndPersist(
    user: RequestUser,
    imageBuffer: Buffer,
    body: VisionOutfitRecolorBodyDto,
    visionContext?: GarmentRecolorVisionContext,
  ) {
    try {
      const result = await this.fashnGarmentRecolorService.recolor({
        imageBuffer,
        targetColorAr: body.targetColorAr,
        targetColorHex: body.targetColorHex,
        garmentLabelAr: body.garmentLabelAr,
        customPromptAr: body.customPromptAr,
        visionContext,
      });

      const attempt = await this.atelierAttempts.persistAccepted(
        user,
        result,
        visionContext,
        body.outfitAnalysisId,
      );

      return { ...result, recolorAttemptId: attempt.id };
    } catch (err) {
      if (
        err instanceof UnprocessableEntityException &&
        body.garmentLabelAr &&
        body.targetColorAr
      ) {
        const payload = err.getResponse() as { qel?: import('../vision/qel/garment-qel.service').QelEvaluation };
        try {
          await this.atelierAttempts.persistRejected(user, {
            garmentLabelAr: body.garmentLabelAr,
            targetColorAr: body.targetColorAr,
            targetColorHex: body.targetColorHex,
            regionRole: visionContext?.regionRole,
            visionContext,
            outfitAnalysisId: body.outfitAnalysisId,
            qel: payload.qel,
          });
        } catch {
          // best-effort
        }
      }
      throw err;
    }
  }

  /** Combined skin + outfit + style fusion + unified recommendations. */
  @Post('full-mira-analysis')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'skinImage', maxCount: 1 },
        { name: 'outfitImage', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: MAX_IMAGE_BYTES },
      },
    ),
  )
  fullMiraAnalysis(
    @CurrentUser() user: RequestUser,
    @UploadedFiles()
    files: {
      skinImage?: Express.Multer.File[];
      outfitImage?: Express.Multer.File[];
    },
    @Body() body: FullMiraAnalysisBodyDto,
  ) {
    return this.fullMiraAnalysisService.analyze(
      user,
      files.skinImage?.[0]?.buffer ?? Buffer.alloc(0),
      files.outfitImage?.[0]?.buffer ?? Buffer.alloc(0),
      body.occasion,
    );
  }
}

function parseGarmentVisionContext(raw?: string): GarmentRecolorVisionContext | undefined {
  if (!raw?.trim()) return undefined;
  try {
    return JSON.parse(raw) as GarmentRecolorVisionContext;
  } catch {
    return undefined;
  }
}
