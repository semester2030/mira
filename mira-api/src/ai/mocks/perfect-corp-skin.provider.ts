import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { SkinAnalysisProviderResult } from '../contracts/skin-analysis-provider-result.interface';
import { PERFECT_HD_FACE_EXPLORER_ACTIONS } from '../contracts/perfect-hd-mask.types';
import { SkinAnalysisProvider } from '../providers/skin-analysis.provider';
import { PerfectCorpService } from '../services/perfect-corp.service';
import { buildYouCamImageVariants } from '../utils/youcam-image-variants';
import {
  classifyYouCamCaptureError,
  isFaceBlockingYouCamError,
  isFaceQualityYouCamError,
  isFaceRecaptureImmediateYouCamError,
} from '../face-gate/youcam-face-errors';
import { MockSkinAnalysisProvider } from './mock-skin-analysis.provider';
import {
  isPerfectMockFallbackAllowed,
  isProductionEnv,
} from '../../config/production-integrity';
import { SKIN_PROVIDER_UNAVAILABLE_AR } from '../../intelligence/contracts/cosmetic-copy';
import { parsePerfectHdMaskPayload } from '../services/perfect-hd-mask.parser';
import { materializeHdMaskArtifacts } from '../services/materialize-hd-masks';

const HD_MIN_SHORT_SIDE = 1080;

/**
 * Skin analysis via Perfect Corp YouCam (Render / mira-api only).
 * Flutter never calls Perfect Corp directly.
 *
 * Production path: ONE HD Perfect task (Face Explorer masks + scores).
 * No SD+HD mix. No parallel Perfect client.
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
        const out = await this.analyzeHdVariant(variants[i]);
        if (i > 0) {
          this.logger.log(
            `YouCam HD succeeded on auto-retry variant ${i + 1}/${variants.length}`,
          );
        }
        return out;
      } catch (error) {
        lastMessage = error instanceof Error ? error.message : String(error);

        if (
          error instanceof BadRequestException ||
          error instanceof ServiceUnavailableException
        ) {
          throw error;
        }

        const capture = classifyYouCamCaptureError(lastMessage);
        if (
          isFaceRecaptureImmediateYouCamError(lastMessage) ||
          isFaceBlockingYouCamError(lastMessage)
        ) {
          this.logger.warn(
            `YouCam capture rejection (${capture?.code ?? 'capture'}) — no variant retry`,
          );
          throw new BadRequestException(
            capture ?? {
              code: 'INVALID_IMAGE',
              category: 'capture_quality',
              message:
                'تعذر تحليل الصورة — تأكدي من وضوح الوجه وقرب الكاميرا.',
              retryable: false,
              requiresRecapture: true,
              userAction: 'recapture',
            },
          );
        }

        const qualityIssue = isFaceQualityYouCamError(lastMessage);
        const hasNext = i < variants.length - 1;

        if (qualityIssue && hasNext) {
          this.logger.warn(
            `YouCam HD variant ${i + 1}/${variants.length} failed (${lastMessage}) — retrying with enhanced image`,
          );
          continue;
        }

        this.logger.error(`YouCam HD skin analysis failed: ${lastMessage}`);

        if (qualityIssue && capture) {
          throw new BadRequestException(capture);
        }

        if (allowFallback) {
          this.logger.warn(
            'Non-face YouCam failure — falling back to mock (non-production only)',
          );
          return this.mock.analyze(imageBytes);
        }

        throw new ServiceUnavailableException({
          code: 'PROVIDER_UNAVAILABLE',
          category: 'provider',
          message: 'تعذر بدء التحليل حاليًا. يمكنك المحاولة مرة أخرى بعد قليل.',
          messageEn: 'Analysis is temporarily unavailable. Try again shortly.',
          retryable: true,
          requiresRecapture: false,
          userAction: 'retry',
        });
      }
    }

    if (allowFallback) {
      this.logger.warn('Falling back to mock skin analysis (non-production only)');
      return this.mock.analyze(imageBytes);
    }

    const capture = classifyYouCamCaptureError(lastMessage);
    if (capture) {
      throw new BadRequestException(capture);
    }
    throw new ServiceUnavailableException({
      code: 'PROVIDER_UNAVAILABLE',
      category: 'provider',
      message: 'تعذر بدء التحليل حاليًا. يمكنك المحاولة مرة أخرى بعد قليل.',
      messageEn: 'Analysis is temporarily unavailable. Try again shortly.',
      retryable: true,
      requiresRecapture: false,
      userAction: 'retry',
    });
  }

  private async analyzeHdVariant(
    imageBytes: Buffer,
  ): Promise<SkinAnalysisProviderResult> {
    const meta = await sharp(imageBytes, { failOn: 'none' })
      .rotate()
      .metadata();
    const sourceWidth = meta.width ?? 0;
    const sourceHeight = meta.height ?? 0;
    const shortSide = Math.min(sourceWidth, sourceHeight);
    if (shortSide < HD_MIN_SHORT_SIDE) {
      throw new BadRequestException({
        code: 'hd_resolution_insufficient',
        category: 'capture_quality',
        message: `تحليل البشرة المكاني يتطلب ضلعًا أقصر ≥ ${HD_MIN_SHORT_SIDE} بكسل (الحالي ${shortSide}). أعيدي الالتقاط أقرب.`,
        messageEn: `Spatial skin analysis requires short side ≥ ${HD_MIN_SHORT_SIDE}px (got ${shortSide}). Retake closer.`,
        retryable: false,
        requiresRecapture: true,
        userAction: 'recapture',
        sourceWidth,
        sourceHeight,
      });
    }

    const dstActions = [...PERFECT_HD_FACE_EXPLORER_ACTIONS];
    const { rawYouCam } = await this.perfectCorp.analyzeSkinHdMasks(
      imageBytes,
      dstActions,
    );

    const parsed = parsePerfectHdMaskPayload(rawYouCam);
    const { ephemeralMasks } = await materializeHdMaskArtifacts(
      parsed.artifacts,
      sourceWidth,
      sourceHeight,
    );

    // Scores: reuse extractConcerns path via mapYouCamResults on raw data.
    const result = this.perfectCorp.mapFromRawYouCam(rawYouCam).result;

    this.logger.log(
      `YouCam HD Skin OK masks=${ephemeralMasks.filter((m) => m.maskBase64).length} dims=${sourceWidth}x${sourceHeight}`,
    );

    return {
      result,
      rawYouCam,
      isMock: false,
      providerName: 'perfect_corp',
      ephemeralMasks,
      sourceWidth,
      sourceHeight,
    };
  }
}
