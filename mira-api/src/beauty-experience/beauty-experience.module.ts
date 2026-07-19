import { Module } from '@nestjs/common';
import { FoundationBeautyExperienceAdapter } from './adapters/foundation-beauty-experience.adapter';
import { BEAUTY_EXPERIENCE_PORT } from './port/beauty-experience.port';

@Module({
  providers: [
    FoundationBeautyExperienceAdapter,
    {
      provide: BEAUTY_EXPERIENCE_PORT,
      useExisting: FoundationBeautyExperienceAdapter,
    },
  ],
  exports: [BEAUTY_EXPERIENCE_PORT, FoundationBeautyExperienceAdapter],
})
export class BeautyExperienceModule {}
