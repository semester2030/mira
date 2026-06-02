import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from './ai/ai.module';
import { AiGatewayModule } from './ai/ai-gateway.module';
import { CommonModule } from './common/common.module';
import { HealthModule } from './health/health.module';
import { OutfitAnalysisModule } from './outfit-analysis/outfit-analysis.module';
import { PrismaModule } from './prisma/prisma.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { RedisModule } from './redis/redis.module';
import { SkinAnalysisModule } from './skin-analysis/skin-analysis.module';
import { FeedbackModule } from './feedback/feedback.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { UsersModule } from './users/users.module';
import { MarketplaceModule } from './marketplace/marketplace.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    CommonModule,
    AiModule,
    AiGatewayModule,
    SubscriptionsModule,
    HealthModule,
    UsersModule,
    SkinAnalysisModule,
    OutfitAnalysisModule,
    RecommendationsModule,
    FeedbackModule,
    MarketplaceModule,
  ],
})
export class AppModule {}
