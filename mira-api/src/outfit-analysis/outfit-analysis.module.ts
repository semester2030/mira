import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { UsersModule } from '../users/users.module';
import { OutfitAnalysisController } from './outfit-analysis.controller';
import { OutfitAnalysisService } from './outfit-analysis.service';

@Module({
  imports: [AiModule, UsersModule],
  controllers: [OutfitAnalysisController],
  providers: [OutfitAnalysisService],
})
export class OutfitAnalysisModule {}
