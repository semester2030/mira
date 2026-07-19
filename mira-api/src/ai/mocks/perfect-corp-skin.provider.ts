import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkinAnalysisProviderResult } from '../contracts/skin-analysis-provider-result.interface';
import { SkinAnalysisProvider } from '../providers/skin-analysis.provider';
import { PerfectCorpService } from '../services/perfect-corp.service';
import { buildYouCamImageVariants } from '../utils/youcam-image-variants';
import {
  faceGateMessageFromYouCam,
  isFaceBlockingYouCamError,
  isFaceQualityYouCamError,
} from '../face-gate/youcam-face-errors';
import { MockSkinAnalysisProvider } from './mock-skin-analysis.provider';
import {
  isPerfectMockFallbackAllowed,
  isProductionEnv,
} from '../../config/production-integrity';
import {
  SKIN_PROVIDER_UNAVAILABLE_AR,
} from '../../intelligence/contracts/cosmetic-copy';

/**
 * Skin analysis via Perfect Corp YouCam (Render / mira-api only).
 * Flutter never calls Perfect Corp directly.
 *
 * Phase 0: never silently return mock results in production.
 */
@Injectable()
export class PerfectCorpSkinProvider implements SkinAnalysisProvider {
  private readonly logger = new Logger(PerfectCorpSkinProvider.name);

  constructor(
    private readonly perfectCorp: PerfectCorpService,
    private readonly mock: MockSkinAnalysisProvider,
    private readonly config: ConfigService,
  ) {}

  async analyze(imageBytes: Buffer): Promise<SkinAnalysisProviderResult> {
    const production = isProductionEnv(this.config.get<string>('NODE_ENV'));
    const allowFallback = isPerfectMockFallbackAllowed({
      NODE_ENV: this.config.get<string>('NODE_ENV'),
      PERFECT_CORP_FALLBACK_MOCK: this.config.get<string>(
        'PERFECT_CORP_FALLBACK_MOCK',
      ),
    });

    if (!this.perfectCorp.isConfigured()) {
      if (production || !allowFallback) {
        this.logger.error(
          'PERFECT_API_KEY missing — refusing mock in production / when fallback disabled',
        );
        throw new ServiceUnavailableException(SKIN_PROVIDER_UNAVAILABLE_AR);
      }
      this.logger.warn(
        'PERFECT_API_KEY / PERFECT_CORP_API_KEY not set — using mock skin analysis (dev/demo only)',
      );
      return this.mock.analyze(imageBytes);
    }

    const variants = await buildYouCamImageVariants(imageBytes);
    let lastMessage = '';

    for (let i = 0; i < variants.length; i++) {
      try {
        const { result, rawYouCam } = await this.perfectCorp.analyzeSkin(
          variants[i],
        );
        if (i > 0) {
          this.logger.log(
            `YouCam succeeded on auto-retry variant ${i + 1}/${variants.length}`,
          );
        }
        return {
          result,
          rawYouCam,
          isMock: false,
          providerName: 'perfect_corp',
        };
      } catch (error) {
        lastMessage = error instanceof Error ? error.message : String(error);

        if (isFaceBlockingYouCamError(lastMessage)) {
          throw new BadRequestException(faceGateMessageFromYouCam(lastMessage));
        }

        const qualityIssue = isFaceQualityYouCamError(lastMessage);
        const hasNext = i < variants.length - 1;

        if (qualityIssue && hasNext) {
          this.logger.warn(
            `YouCam variant ${i + 1}/${variants.length} failed (${lastMessage}) — retrying with enhanced image`,
          );
          continue;
        }

        this.logger.error(`YouCam skin analysis failed: ${lastMessage}`);

        if (qualityIssue) {
          throw new BadRequestException(faceGateMessageFromYouCam(lastMessage));
        }

        if (allowFallback) {
          this.logger.warn(
            'Non-face YouCam failure — falling back to mock (non-production only)',
          );
          return this.mock.analyze(imageBytes);
        }

        throw new InternalServerErrorException(
          `YouCam skin analysis failed: ${lastMessage}`,
        );
      }
    }

    if (allowFallback) {
      this.logger.warn('Falling back to mock skin analysis (non-production only)');
      return this.mock.analyze(imageBytes);
    }

    throw new InternalServerErrorException(
      `YouCam skin analysis failed: ${lastMessage || 'unknown error'}`,
    );
  }
}
