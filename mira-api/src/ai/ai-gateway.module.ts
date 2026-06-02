import { Module } from '@nestjs/common';
import { OutfitAnalysisModule } from '../outfit-analysis/outfit-analysis.module';
import { SkinAnalysisModule } from '../skin-analysis/skin-analysis.module';
import { AiGatewayController } from './ai-gateway.controller';

@Module({
  imports: [SkinAnalysisModule, OutfitAnalysisModule],
  controllers: [AiGatewayController],
})
export class AiGatewayModule {}
