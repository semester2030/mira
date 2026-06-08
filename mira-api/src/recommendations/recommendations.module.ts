import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { UsersModule } from '../users/users.module';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';

@Module({
  imports: [AiModule, UsersModule],
  controllers: [RecommendationsController],
  providers: [RecommendationsService],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
