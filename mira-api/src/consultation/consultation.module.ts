import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { RedisModule } from '../redis/redis.module';
import { UsersModule } from '../users/users.module';
import { ConsultationController } from './consultation.controller';
import { ConsultationMessageService } from './services/consultation-message.service';
import { ConsultationOrchestratorService } from './services/consultation-orchestrator.service';
import { ConsultationSessionService } from './services/consultation-session.service';
import { MceContextSnapshotService } from './services/mce-context-snapshot.service';
import { MceCostGuardService } from './services/mce-cost-guard.service';
import { MceFactExtractorService } from './services/mce-fact-extractor.service';
import { MceGroundingPipelineService } from './services/mce-grounding-pipeline.service';
import { MceLlmService } from './services/mce-llm.service';
import { MceMemoryCompactionService } from './services/mce-memory-compaction.service';
import { MceModerationService } from './services/mce-moderation.service';
import { MceIntentClassifierService } from './services/mce-intent-classifier.service';
import {
  McePromptAssemblerService,
  MceResponseValidatorService,
} from './services/mce-prompt-assembler.service';

@Module({
  imports: [IntelligenceModule, UsersModule, CommonModule, RedisModule],
  controllers: [ConsultationController],
  providers: [
    MceFactExtractorService,
    MceIntentClassifierService,
    MceGroundingPipelineService,
    MceContextSnapshotService,
    MceModerationService,
    McePromptAssemblerService,
    MceResponseValidatorService,
    MceLlmService,
    MceMemoryCompactionService,
    MceCostGuardService,
    ConsultationSessionService,
    ConsultationMessageService,
    ConsultationOrchestratorService,
  ],
  exports: [ConsultationOrchestratorService, MceGroundingPipelineService],
})
export class ConsultationModule {}
