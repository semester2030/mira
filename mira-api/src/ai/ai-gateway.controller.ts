import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
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
