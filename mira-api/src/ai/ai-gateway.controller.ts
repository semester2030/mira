import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  BadRequestException,
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
import { FullMiraAnalysisService } from './services/full-mira-analysis.service';
import { OutfitHybridIntelligenceService } from './services/outfit-hybrid-intelligence.service';
import { OutfitSegmentationService } from './segmentation/outfit-segmentation.service';
import { OutfitIntelligenceBodyDto } from './dto/outfit-intelligence-body.dto';
import { SkinReportSnapshot } from './contracts/outfit-intelligence.interface';
import { VisionOrchestratorService } from '../vision/vision-orchestrator.service';
import { VisionOutfitAnalyzeBodyDto } from '../vision/dto/vision-outfit-analyze-body.dto';
import { VisionOutfitRecolorBodyDto } from '../vision/dto/vision-outfit-recolor-body.dto';
import { FashnGarmentRecolorService } from '../vision/recolor/fashn-garment-recolor.service';
import { GarmentRecolorVisionContext } from '../vision/qel/garment-recolor-context.types';

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
    private readonly outfitAnalysisService: OutfitAnalysisService,
    private readonly fullMiraAnalysisService: FullMiraAnalysisService,
    private readonly outfitHybridIntelligenceService: OutfitHybridIntelligenceService,
    private readonly outfitSegmentationService: OutfitSegmentationService,
    private readonly visionOrchestrator: VisionOrchestratorService,
    private readonly fashnGarmentRecolorService: FashnGarmentRecolorService,
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
  ) {
    return this.skinAnalysisService.analyze(
      user,
      file?.buffer ?? Buffer.alloc(0),
    );
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
  analyzeOutfitIntelligence(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: OutfitIntelligenceBodyDto,
  ) {
    const skin = JSON.parse(body.skinReport) as SkinReportSnapshot;
    return this.outfitHybridIntelligenceService.analyze(
      file?.buffer ?? Buffer.alloc(0),
      body.occasion,
      skin,
    );
  }

  /** Pixel-refined garment contours — Vision bbox + server-side mask tracing. */
  @Post('outfit-segmentation')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_BYTES },
    }),
  )
  analyzeOutfitSegmentation(@UploadedFile() file: Express.Multer.File) {
    return this.outfitSegmentationService.segment(file?.buffer ?? Buffer.alloc(0));
  }

  /**
   * Vision Platform — official outfit vision entry (Phase 2+).
   * Flutter must use this endpoint only — no client-side vision providers.
   * Reference: docs/mira-vision-platform.html
   */
  @Post('vision/outfit/analyze')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_BYTES },
    }),
  )
  analyzeVisionOutfit(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: VisionOutfitAnalyzeBodyDto,
  ) {
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

    return this.visionOrchestrator.analyze({
      imageBuffer: file?.buffer ?? Buffer.alloc(0),
      occasionId: body.occasionId,
      mode: body.mode,
      skinSnapshot,
      locale: body.locale ?? 'ar',
    });
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
  recolorVisionOutfit(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: VisionOutfitRecolorBodyDto,
  ) {
    return this.fashnGarmentRecolorService.recolor({
      imageBuffer: file?.buffer ?? Buffer.alloc(0),
      targetColorAr: body.targetColorAr,
      targetColorHex: body.targetColorHex,
      garmentLabelAr: body.garmentLabelAr,
      customPromptAr: body.customPromptAr,
      visionContext: parseGarmentVisionContext(body.visionContext),
    });
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
