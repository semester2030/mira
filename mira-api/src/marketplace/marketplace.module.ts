import { Module } from '@nestjs/common';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard';
import { CatalogAdAdminController, CatalogAdPublicController } from './catalog-ad.controller';
import { CatalogAdService } from './catalog-ad.service';
import { CatalogContentService } from './catalog-content.service';
import { CatalogMediaController } from './catalog-media.controller';
import { CatalogReviewAdminController } from './catalog-review.admin.controller';
import { CatalogMediaStorage, createCatalogMediaStorage } from './catalog-media.storage';
import { ConfigService } from '@nestjs/config';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';

@Module({
  controllers: [MarketplaceController, CatalogMediaController, CatalogReviewAdminController, CatalogAdAdminController, CatalogAdPublicController],
  providers: [
    MarketplaceService,
    CatalogContentService,
    CatalogAdService,
    { provide: CatalogMediaStorage, useFactory: (config: ConfigService) => createCatalogMediaStorage(config), inject: [ConfigService] },
    AdminApiKeyGuard,
  ],
  exports: [MarketplaceService, CatalogContentService, CatalogMediaStorage, CatalogAdService],
})
export class MarketplaceModule {}
