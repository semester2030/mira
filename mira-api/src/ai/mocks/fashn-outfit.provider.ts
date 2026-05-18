import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MiraOccasion } from '../contracts/mira-occasion';
import { OutfitAnalysisResult } from '../contracts/outfit-analysis-result.interface';
import { OutfitAnalysisProvider } from '../providers/outfit-analysis.provider';
import { MockOutfitAnalysisProvider } from './mock-outfit-analysis.provider';

/**
 * Placeholder for FASHN.ai API.
 * Set FASHN_API_KEY — implement HTTP call in analyze().
 */
@Injectable()
export class FashnOutfitProvider implements OutfitAnalysisProvider {
  private readonly logger = new Logger(FashnOutfitProvider.name);
  private readonly mock = new MockOutfitAnalysisProvider();

  constructor(private readonly config: ConfigService) {}

  async analyze(
    imageBytes: Buffer,
    occasion: MiraOccasion,
  ): Promise<OutfitAnalysisResult> {
    const apiKey = this.config.get<string>('FASHN_API_KEY');
    if (!apiKey?.trim()) {
      this.logger.warn('FASHN_API_KEY not set — using mock outfit analysis');
      return this.mock.analyze(imageBytes, occasion);
    }

    // TODO: POST to FASHN.ai when subscription is active
    this.logger.warn('FASHN adapter not implemented yet — using mock');
    return this.mock.analyze(imageBytes, occasion);
  }
}
