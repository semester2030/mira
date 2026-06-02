import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkinAnalysisResult } from '../contracts/skin-analysis-result.interface';
import { SkinAnalysisProvider } from '../providers/skin-analysis.provider';
import { PerfectCorpService } from '../services/perfect-corp.service';
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

    try {
      return await this.perfectCorp.analyzeSkin(imageBytes);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`YouCam skin analysis failed: ${message}`);
      if (allowFallback) {
        this.logger.warn('Falling back to mock skin analysis');
        return this.mock.analyze(imageBytes);
      }
      throw error;
    }
  }
}
