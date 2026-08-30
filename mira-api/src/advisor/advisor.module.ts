import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommonModule } from '../common/common.module';
import { ConsultationModule } from '../consultation/consultation.module';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { BeautyAdvisorService } from '../beauty-advisor/beauty-advisor.service';
import { OpenAiFashionKnowledgeLlmProvider } from '../fashion-knowledge/llm/providers/openai-fashion-knowledge-llm.provider';
import { ProductionEntitlementModule } from '../production-entitlements/production-entitlement.module';
import { AdvisorController } from './advisor.controller';
import {
  AdvisorService,
  FASHION_KNOWLEDGE_LLM_PORT,
} from './advisor.service';

/**
 * AT-2 — Registers production Fashion Knowledge LLM port.
 * Flags remain OFF by default; registration ≠ Mode B enablement.
 * FKL provider is isolated from MCE conversation LLM.
 * Phase 9I — PrismaModule for Face Intelligence evidence projection.
 * PROD-FINAL-1 — ProductionEntitlementModule for owner-allowlist Fashion Mode B.
 */
@Module({
  imports: [
    IntelligenceModule,
    UsersModule,
    CommonModule,
    ConsultationModule,
    PrismaModule,
    ProductionEntitlementModule,
  ],
  controllers: [AdvisorController],
  providers: [
    BeautyAdvisorService,
    {
      provide: FASHION_KNOWLEDGE_LLM_PORT,
      useFactory: (config: ConfigService) =>
        new OpenAiFashionKnowledgeLlmProvider(config),
      inject: [ConfigService],
    },
    AdvisorService,
  ],
  exports: [AdvisorService, BeautyAdvisorService, FASHION_KNOWLEDGE_LLM_PORT],
})
export class AdvisorModule {}
