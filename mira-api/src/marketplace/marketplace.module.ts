import { Module } from '@nestjs/common';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard';
import { CatalogAdAdminController, CatalogAdPublicController } from './catalog-ad.controller';
import { CatalogAdMediaService } from './catalog-ad-media.service';
import { CatalogAdService } from './catalog-ad.service';
import { CatalogContentService } from './catalog-content.service';
import { CommerceAdminController } from './commerce.admin.controller';
import { CommerceController } from './commerce.controller';
import { CommerceService } from './commerce.service';
import { CatalogMediaController } from './catalog-media.controller';
import { CatalogReviewAdminController } from './catalog-review.admin.controller';
import { CatalogMediaStorage, createCatalogMediaStorage } from './catalog-media.storage';
import { ConfigService } from '@nestjs/config';
import {
  CreatorProfilePartnerController,
  CreatorProfilePublicController,
} from './creator-profile.controller';
import { CreatorProfileService } from './creator-profile.service';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';
import { TaxonomyService } from './taxonomy/taxonomy.service';
import { CatalogGuideService } from './taxonomy/catalog-guide.service';

@Module({
  controllers: [
    MarketplaceController,
    CatalogMediaController,
    CatalogReviewAdminController,
    CatalogAdAdminController,
    CatalogAdPublicController,
    CreatorProfilePublicController,
    CommerceController,
    CommerceAdminController,
  ],
  providers: [
    MarketplaceService,
    CatalogContentService,
    CatalogAdMediaService,
    CatalogAdService,
    CreatorProfileService,
    CommerceService,
    TaxonomyService,
    CatalogGuideService,
    { provide: CatalogMediaStorage, useFactory: (config: ConfigService) => createCatalogMediaStorage(config), inject: [ConfigService] },
    AdminApiKeyGuard,
  ],
  exports: [
    MarketplaceService,
    CatalogContentService,
    CatalogMediaStorage,
    CatalogAdService,
    CatalogAdMediaService,
    CreatorProfileService,
    CommerceService,
    TaxonomyService,
    CatalogGuideService,
  ],
})
export class MarketplaceModule {}
