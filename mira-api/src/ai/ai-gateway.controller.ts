import {
  Body,
  Controller,
  NotImplementedException,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { AnalyzeOutfitBodyDto } from '../outfit-analysis/dto/analyze-outfit.dto';
import { OutfitAnalysisService } from '../outfit-analysis/outfit-analysis.service';
import { SkinAnalysisService } from '../skin-analysis/skin-analysis.service';

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

  /** Combined skin + outfit + recommendations — planned for v1.1. */
  @Post('full-mira-analysis')
  fullMiraAnalysis() {
    throw new NotImplementedException(
      'full-mira-analysis is not available yet; use skin-analysis and outfit-analysis',
    );
  }
}
