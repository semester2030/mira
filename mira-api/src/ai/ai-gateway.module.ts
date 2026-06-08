import { Module } from '@nestjs/common';
import { OutfitAnalysisModule } from '../outfit-analysis/outfit-analysis.module';
import { RecommendationsModule } from '../recommendations/recommendations.module';
import { SkinAnalysisModule } from '../skin-analysis/skin-analysis.module';
import { AiGatewayController } from './ai-gateway.controller';
import { FullMiraAnalysisService } from './services/full-mira-analysis.service';

@Module({
  imports: [SkinAnalysisModule, OutfitAnalysisModule, RecommendationsModule],
  controllers: [AiGatewayController],
  providers: [FullMiraAnalysisService],
})
export class AiGatewayModule {}
