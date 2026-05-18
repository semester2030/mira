import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkinAnalysisResult } from '../contracts/skin-analysis-result.interface';
import { SkinAnalysisProvider } from '../providers/skin-analysis.provider';
import { MockSkinAnalysisProvider } from './mock-skin-analysis.provider';

/**
 * Placeholder for Perfect Corp / YouCam API.
 * Set PERFECT_CORP_API_KEY — implement HTTP call in analyze().
 * Falls back to mock when key is missing (development).
 */
@Injectable()
export class PerfectCorpSkinProvider implements SkinAnalysisProvider {
  private readonly logger = new Logger(PerfectCorpSkinProvider.name);
  private readonly mock = new MockSkinAnalysisProvider();

  constructor(private readonly config: ConfigService) {}

  async analyze(imageBytes: Buffer): Promise<SkinAnalysisResult> {
    const apiKey = this.config.get<string>('PERFECT_CORP_API_KEY');
    if (!apiKey?.trim()) {
      this.logger.warn('PERFECT_CORP_API_KEY not set — using mock skin analysis');
      return this.mock.analyze(imageBytes);
    }

    // TODO: POST to Perfect Corp when subscription is active
    this.logger.warn('Perfect Corp adapter not implemented yet — using mock');
    return this.mock.analyze(imageBytes);
  }
}
