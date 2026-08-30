import { Module } from '@nestjs/common';
import { OutfitAnalysisModule } from '../outfit-analysis/outfit-analysis.module';
import { RecommendationsModule } from '../recommendations/recommendations.module';
import { SkinAnalysisModule } from '../skin-analysis/skin-analysis.module';
import { AtelierModule } from '../atelier/atelier.module';
import { AiGatewayController } from './ai-gateway.controller';
import { AiModule } from './ai.module';
import { VisionModule } from '../vision/vision.module';
import { FullMiraAnalysisService } from './services/full-mira-analysis.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    SkinAnalysisModule,
    OutfitAnalysisModule,
    RecommendationsModule,
    AiModule,
    VisionModule,
    AtelierModule,
    CommonModule,
  ],
  controllers: [AiGatewayController],
  providers: [FullMiraAnalysisService],
})
export class AiGatewayModule {}
