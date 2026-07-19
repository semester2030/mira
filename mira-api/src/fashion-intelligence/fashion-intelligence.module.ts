import { Module } from '@nestjs/common';
import {
  InMemoryFashionSessionRepository,
  InMemoryWardrobeRepository,
} from './repository/in-memory.repository';
import {
  FASHION_SESSION_REPOSITORY,
  WARDROBE_REPOSITORY,
} from './repository/wardrobe.repository';
import { WardrobeService } from './service/wardrobe.service';
import { FashionSessionService } from './service/fashion-session.service';
import { GarmentIntelligenceService } from './garment/garment-intelligence.service';
import { OutfitIntelligenceService } from './outfit/outfit-intelligence.service';
import { StylingIntelligenceService } from './styling/styling-intelligence.service';

@Module({
  providers: [
    InMemoryWardrobeRepository,
    InMemoryFashionSessionRepository,
    {
      provide: WARDROBE_REPOSITORY,
      useExisting: InMemoryWardrobeRepository,
    },
    {
      provide: FASHION_SESSION_REPOSITORY,
      useExisting: InMemoryFashionSessionRepository,
    },
    WardrobeService,
    FashionSessionService,
    GarmentIntelligenceService,
    OutfitIntelligenceService,
    StylingIntelligenceService,
  ],
  exports: [
    WardrobeService,
    FashionSessionService,
    GarmentIntelligenceService,
    OutfitIntelligenceService,
    StylingIntelligenceService,
    WARDROBE_REPOSITORY,
    FASHION_SESSION_REPOSITORY,
    InMemoryWardrobeRepository,
    InMemoryFashionSessionRepository,
  ],
})
export class FashionIntelligenceModule {}
