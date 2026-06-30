import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VisionModule } from '../vision/vision.module';
import { MiraRecommendationEngine } from './engine/mira-recommendation.engine';
import { LlmOutfitReasoningService } from './llm/llm-outfit-reasoning.service';
import { FashnOutfitProvider } from './mocks/fashn-outfit.provider';
import { MockOutfitAnalysisProvider } from './mocks/mock-outfit-analysis.provider';
import { MockSkinAnalysisProvider } from './mocks/mock-skin-analysis.provider';
import { PerfectCorpSkinProvider } from './mocks/perfect-corp-skin.provider';
import { PerfectCorpService } from './services/perfect-corp.service';
import { OutfitHybridIntelligenceService } from './services/outfit-hybrid-intelligence.service';
import { OutfitSegmentationService } from './segmentation/outfit-segmentation.service';
import { FaceGateService } from './face-gate/face-gate.service';
import { OutfitQualityGateService } from './outfit-gate/outfit-quality-gate.service';
import {
  OUTFIT_ANALYSIS_PROVIDER,
  OutfitAnalysisProvider,
} from './providers/outfit-analysis.provider';
import {
  SKIN_ANALYSIS_PROVIDER,
  SkinAnalysisProvider,
} from './providers/skin-analysis.provider';

@Module({
  imports: [VisionModule],
  providers: [
    MiraRecommendationEngine,
    MockSkinAnalysisProvider,
    MockOutfitAnalysisProvider,
    PerfectCorpService,
    FaceGateService,
    OutfitQualityGateService,
    PerfectCorpSkinProvider,
    FashnOutfitProvider,
    LlmOutfitReasoningService,
    OutfitHybridIntelligenceService,
    OutfitSegmentationService,
    {
      provide: SKIN_ANALYSIS_PROVIDER,
      inject: [ConfigService, PerfectCorpSkinProvider, MockSkinAnalysisProvider],
      useFactory: (
        config: ConfigService,
        perfectCorp: PerfectCorpSkinProvider,
        mock: MockSkinAnalysisProvider,
      ): SkinAnalysisProvider => {
        const provider = config.get<string>('SKIN_PROVIDER', 'mock');
        if (provider === 'perfect_corp') return perfectCorp;
        return mock;
      },
    },
    {
      provide: OUTFIT_ANALYSIS_PROVIDER,
      inject: [ConfigService, FashnOutfitProvider, MockOutfitAnalysisProvider],
      useFactory: (
        config: ConfigService,
        fashn: FashnOutfitProvider,
        mock: MockOutfitAnalysisProvider,
      ): OutfitAnalysisProvider => {
        const provider = config.get<string>('OUTFIT_PROVIDER', 'mock');
        if (provider === 'fashn') return fashn;
        return mock;
      },
    },
  ],
  exports: [
    SKIN_ANALYSIS_PROVIDER,
    OUTFIT_ANALYSIS_PROVIDER,
    MiraRecommendationEngine,
    FaceGateService,
    OutfitQualityGateService,
    LlmOutfitReasoningService,
    OutfitHybridIntelligenceService,
    OutfitSegmentationService,
  ],
})
export class AiModule {}
