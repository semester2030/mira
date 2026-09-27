import { Module } from '@nestjs/common';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { CatalogAdPartnerController } from '../marketplace/catalog-ad.controller';
import { PartnerTokenGuard } from './guards/partner-token.guard';
import { PartnersPortalController } from './partners-portal.controller';
import { PartnersPortalService } from './partners-portal.service';

@Module({
  imports: [MarketplaceModule],
  controllers: [PartnersPortalController, CatalogAdPartnerController],
  providers: [PartnersPortalService, AdminApiKeyGuard, PartnerTokenGuard],
  exports: [PartnersPortalService],
})
export class PartnersPortalModule {}
