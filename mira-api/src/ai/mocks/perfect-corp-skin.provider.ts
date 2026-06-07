import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkinAnalysisResult } from '../contracts/skin-analysis-result.interface';
import { SkinAnalysisProvider } from '../providers/skin-analysis.provider';
import { PerfectCorpService } from '../services/perfect-corp.service';
import {
  buildYouCamImageVariants,
  isRecoverableYouCamError,
} from '../utils/youcam-image-variants';
import { MockSkinAnalysisProvider } from './mock-skin-analysis.provider';

/**
 * Skin analysis via Perfect Corp YouCam (Render / mira-api only).
 * Flutter never calls Perfect Corp directly.
 */
@Injectable()
export class PerfectCorpSkinProvider implements SkinAnalysisProvider {
  private readonly logger = new Logger(PerfectCorpSkinProvider.name);

  constructor(
    private readonly perfectCorp: PerfectCorpService,
    private readonly mock: MockSkinAnalysisProvider,
    private readonly config: ConfigService,
  ) {}

  async analyze(imageBytes: Buffer): Promise<SkinAnalysisResult> {
    if (!this.perfectCorp.isConfigured()) {
      this.logger.warn(
        'PERFECT_API_KEY / PERFECT_CORP_API_KEY not set — using mock skin analysis',
      );
      return this.mock.analyze(imageBytes);
    }

    const allowFallback =
      this.config.get<string>('PERFECT_CORP_FALLBACK_MOCK', 'true') !== 'false';

    const variants = await buildYouCamImageVariants(imageBytes);
    let lastMessage = '';

    for (let i = 0; i < variants.length; i++) {
      try {
        const result = await this.perfectCorp.analyzeSkin(variants[i]);
        if (i > 0) {
          this.logger.log(
            `YouCam succeeded on auto-retry variant ${i + 1}/${variants.length}`,
          );
        }
        return result;
      } catch (error) {
        lastMessage = error instanceof Error ? error.message : String(error);
        const recoverable = isRecoverableYouCamError(lastMessage);
        const hasNext = i < variants.length - 1;

        if (recoverable && hasNext) {
          this.logger.warn(
            `YouCam variant ${i + 1}/${variants.length} failed (${lastMessage}) — retrying with enhanced image`,
          );
          continue;
        }

        this.logger.error(`YouCam skin analysis failed: ${lastMessage}`);

        if (allowFallback && recoverable) {
          this.logger.warn(
            'All YouCam variants failed — falling back to mock skin analysis',
          );
          return this.mock.analyze(imageBytes);
        }

        if (lastMessage.includes('error_src_face_too_small')) {
          throw new BadRequestException(
            'تعذر تحليل الصورة — أعيدي التقاط صورة أقرب مع إضاءة أمامية.',
          );
        }
        if (lastMessage.includes('error_lighting_dark')) {
          throw new BadRequestException(
            'الإضاءة ضعيفة — انتقلي لمكان أفضل ثم أعيدي المحاولة.',
          );
        }

        throw new InternalServerErrorException(
          `YouCam skin analysis failed: ${lastMessage}`,
        );
      }
    }

    if (allowFallback) {
      this.logger.warn('Falling back to mock skin analysis');
      return this.mock.analyze(imageBytes);
    }

    throw new InternalServerErrorException(
      `YouCam skin analysis failed: ${lastMessage || 'unknown error'}`,
    );
  }
}
