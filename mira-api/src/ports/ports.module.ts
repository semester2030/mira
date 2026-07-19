import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiModule } from '../ai/ai.module';
import { VisionModule } from '../vision/vision.module';
import { PerfectCorpSkinAdapter } from './adapters/perfect-corp-skin.adapter';
import { MockSkinAdapter } from './adapters/mock-skin.adapter';
import { VisionFashionAdapter } from './adapters/vision-fashion.adapter';
import { CaptureImageQualityAdapter } from './adapters/capture-image-quality.adapter';
import { DisabledBeautyTryOnAdapter } from './adapters/disabled-beauty-tryon.adapter';
import { NoopAnalysisTelemetryAdapter } from './adapters/noop-analysis-telemetry.adapter';
import { SkinAnalysisOrchestrator } from './orchestrators/skin-analysis.orchestrator';
import { FashionAnalysisOrchestrator } from './orchestrators/fashion-analysis.orchestrator';
import { SKIN_ANALYSIS_PORT } from './skin/skin-analysis.port';
import { FASHION_ANALYSIS_PORT } from './fashion/fashion-analysis.port';
import { IMAGE_QUALITY_PORT } from './image-quality/image-quality.port';
import { BEAUTY_TRYON_PORT } from './beauty-tryon/beauty-tryon.port';
import { ANALYSIS_TELEMETRY_PORT } from './telemetry/analysis-telemetry.port';
import { isProductionEnv } from '../config/production-integrity';

@Global()
@Module({
  imports: [AiModule, VisionModule],
  providers: [
    PerfectCorpSkinAdapter,
    MockSkinAdapter,
    VisionFashionAdapter,
    CaptureImageQualityAdapter,
    DisabledBeautyTryOnAdapter,
    NoopAnalysisTelemetryAdapter,
    SkinAnalysisOrchestrator,
    FashionAnalysisOrchestrator,
    {
      provide: ANALYSIS_TELEMETRY_PORT,
      useExisting: NoopAnalysisTelemetryAdapter,
    },
    {
      provide: IMAGE_QUALITY_PORT,
      useExisting: CaptureImageQualityAdapter,
    },
    {
      provide: BEAUTY_TRYON_PORT,
      useExisting: DisabledBeautyTryOnAdapter,
    },
    {
      provide: FASHION_ANALYSIS_PORT,
      useExisting: VisionFashionAdapter,
    },
    {
      provide: SKIN_ANALYSIS_PORT,
      inject: [ConfigService, PerfectCorpSkinAdapter, MockSkinAdapter],
      useFactory: (
        config: ConfigService,
        perfect: PerfectCorpSkinAdapter,
        mock: MockSkinAdapter,
      ) => {
        const provider = config.get<string>('SKIN_PROVIDER', 'mock');
        const production = isProductionEnv(config.get<string>('NODE_ENV'));
        if (provider === 'perfect_corp') return perfect;
        if (production) return perfect; // never bind mock in prod
        return mock;
      },
    },
  ],
  exports: [
    SKIN_ANALYSIS_PORT,
    FASHION_ANALYSIS_PORT,
    IMAGE_QUALITY_PORT,
    BEAUTY_TRYON_PORT,
    ANALYSIS_TELEMETRY_PORT,
    SkinAnalysisOrchestrator,
    FashionAnalysisOrchestrator,
    PerfectCorpSkinAdapter,
    MockSkinAdapter,
    VisionFashionAdapter,
    CaptureImageQualityAdapter,
    DisabledBeautyTryOnAdapter,
  ],
})
export class PortsModule {}
