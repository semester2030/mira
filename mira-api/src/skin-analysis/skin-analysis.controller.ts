import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { SkinAnalysisService } from './skin-analysis.service';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

@Controller('skin-analysis')
@UseGuards(FirebaseAuthGuard)
export class SkinAnalysisController {
  constructor(private readonly skinAnalysisService: SkinAnalysisService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_BYTES },
    }),
  )
  async analyze(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
    /** Phase 4.5 — optional multipart `faceIntel` JSON string. */
    @Body() body?: { faceIntel?: string },
  ) {
    return this.skinAnalysisService.analyze(
      user,
      file?.buffer ?? Buffer.alloc(0),
      body?.faceIntel,
    );
  }

  @Get('history')
  async history(
    @CurrentUser() user: RequestUser,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? parseInt(limit, 10) : 20;
    return this.skinAnalysisService.history(user, Number.isNaN(parsed) ? 20 : parsed);
  }
}
