import { Module } from '@nestjs/common';
import { AdminApiKeyGuard } from './guards/admin-api-key.guard';
import { PartnerTokenGuard } from './guards/partner-token.guard';
import { PartnersPortalController } from './partners-portal.controller';
import { PartnersPortalService } from './partners-portal.service';

@Module({
  controllers: [PartnersPortalController],
  providers: [PartnersPortalService, AdminApiKeyGuard, PartnerTokenGuard],
  exports: [PartnersPortalService],
})
export class PartnersPortalModule {}
