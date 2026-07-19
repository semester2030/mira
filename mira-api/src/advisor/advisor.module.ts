import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { ConsultationModule } from '../consultation/consultation.module';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { UsersModule } from '../users/users.module';
import { BeautyAdvisorService } from '../beauty-advisor/beauty-advisor.service';
import { AdvisorController } from './advisor.controller';
import { AdvisorService } from './advisor.service';

@Module({
  imports: [IntelligenceModule, UsersModule, CommonModule, ConsultationModule],
  controllers: [AdvisorController],
  providers: [AdvisorService, BeautyAdvisorService],
  exports: [AdvisorService, BeautyAdvisorService],
})
export class AdvisorModule {}
