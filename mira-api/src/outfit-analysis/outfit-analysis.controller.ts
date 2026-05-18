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
import { AnalyzeOutfitBodyDto } from './dto/analyze-outfit.dto';
import { OutfitAnalysisService } from './outfit-analysis.service';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

@Controller('outfit-analysis')
@UseGuards(FirebaseAuthGuard)
export class OutfitAnalysisController {
  constructor(private readonly outfitAnalysisService: OutfitAnalysisService) {}

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
    @Body() body: AnalyzeOutfitBodyDto,
  ) {
    return this.outfitAnalysisService.analyze(
      user,
      file?.buffer ?? Buffer.alloc(0),
      body.occasion,
    );
  }

  @Get('history')
  async history(
    @CurrentUser() user: RequestUser,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? parseInt(limit, 10) : 20;
    return this.outfitAnalysisService.history(
      user,
      Number.isNaN(parsed) ? 20 : parsed,
    );
  }
}
