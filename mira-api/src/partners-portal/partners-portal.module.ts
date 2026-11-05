import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { MultipartUploadStore, createMultipartUploadStore } from './upload-sessions/multipart.store';
import { UploadCleanupService } from './upload-sessions/upload-cleanup.service';
import { UploadFinalizeService } from './upload-sessions/upload-finalize.service';
import { UploadSessionsController } from './upload-sessions/upload-sessions.controller';
import { UploadSessionsService } from './upload-sessions/upload-sessions.service';
import { VariantInventoryService } from './variant-inventory.service';

@Module({
  imports: [MarketplaceModule],
  controllers: [
    PartnersPortalController,
    CatalogAdPartnerController,
    CommercePartnerController,
    UploadSessionsController,
  ],
  providers: [
    PartnersPortalService,
    AdminApiKeyGuard,
    PartnerTokenGuard,
    RegistryService,
    EditorDraftsService,
    ServiceProfileService,
    VariantInventoryService,
    {
      provide: MultipartUploadStore,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => createMultipartUploadStore(config),
    },
    UploadFinalizeService,
    UploadCleanupService,
    UploadSessionsService,
  ],
  exports: [PartnersPortalService, RegistryService, UploadSessionsService, VariantInventoryService],
})
export class PartnersPortalModule {}
