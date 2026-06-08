import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { UsersModule } from '../users/users.module';
import { SkinAnalysisController } from './skin-analysis.controller';
import { SkinAnalysisService } from './skin-analysis.service';

@Module({
  imports: [AiModule, UsersModule, IntelligenceModule],
  controllers: [SkinAnalysisController],
  providers: [SkinAnalysisService],
  exports: [SkinAnalysisService],
})
export class SkinAnalysisModule {}
