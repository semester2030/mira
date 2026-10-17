import assert from 'node:assert/strict';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { sanitizeOutfitIntelligence } from './outfit-analysis.service';
import { SaveOutfitSnapshotDto } from './dto/save-outfit-snapshot.dto';

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

async function accept(body: Record<string, unknown>): Promise<SaveOutfitSnapshotDto> {
  return pipe.transform(body, { type: 'body', metatype: SaveOutfitSnapshotDto });
}

async function main(): Promise<void> {
  const full = await accept({
    occasionId: 'eid',
    intelligence: {
      occasionId: 'eid',
      clothingTypeAr: 'فستان',
      styleTypeAr: 'سهرة',
      dominantColorsAr: ['أزرق فاتح'],
      analysisSource: 'hybrid',
      imageFingerprint: 'abc123',
      analysisVersion: 'outfit-intel-v2',
    },
  });
  assert.equal(full.intelligence.dominantColorsAr[0], 'أزرق فاتح');

  const partial = await accept({
    occasionId: 'work',
    intelligence: {
      clothingTypeAr: 'فستان',
      styleTypeAr: 'يومي',
      dominantColorsAr: [],
    },
  });
  const sanitized = sanitizeOutfitIntelligence({
    ...partial.intelligence,
    compatibilityScore: 64,
  });
  assert.equal(sanitized.compatibilityScore, undefined);

  const missingScore = await accept({
    occasionId: 'university',
    intelligence: {
      clothingTypeAr: 'فستان',
      styleTypeAr: 'سهرة',
      dominantColorsAr: ['عنابي'],
    },
  });
  assert.equal(missingScore.intelligence.compatibilityScore, undefined);

  await assert.rejects(
    () => accept({
      occasionId: 'eid',
      intelligence: {
        clothingTypeAr: 'فستان',
        styleTypeAr: 'سهرة',
        dominantColorsAr: ['عنابي'],
        scoreSupported: true,
      },
    }),
    (error: unknown) => error instanceof BadRequestException,
  );

  console.log(JSON.stringify({ checks: 4, failed: 0 }));
}

void main();
