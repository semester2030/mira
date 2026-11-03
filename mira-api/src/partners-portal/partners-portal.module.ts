import { Module } from '@nestjs/common';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { CatalogAdPartnerController } from '../marketplace/catalog-ad.controller';
import { CommercePartnerController } from '../marketplace/commerce-partner.controller';
import { EditorDraftsService } from './editor-drafts/editor-drafts.service';
import { ServiceProfileService } from './editor-drafts/service-profile.service';
import { PartnerTokenGuard } from './guards/partner-token.guard';
import { PartnersPortalController } from './partners-portal.controller';
import { PartnersPortalService } from './partners-portal.service';
import { RegistryService } from './registry/registry.service';

@Module({
  imports: [MarketplaceModule],
  controllers: [PartnersPortalController, CatalogAdPartnerController, CommercePartnerController],
  providers: [
    PartnersPortalService,
    AdminApiKeyGuard,
    PartnerTokenGuard,
    RegistryService,
    EditorDraftsService,
    ServiceProfileService,
  ],
  exports: [PartnersPortalService, RegistryService],
})
export class PartnersPortalModule {}
