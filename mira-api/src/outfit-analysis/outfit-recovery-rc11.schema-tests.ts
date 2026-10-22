import assert from 'node:assert/strict';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
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
  const shortId = 's-abc123-deadbeefcafe';
  const ok = await accept({
    occasionId: 'university',
    clientSaveId: shortId,
    intelligence: {
      clothingTypeAr: 'فستان',
      styleTypeAr: 'يومي',
      dominantColorsAr: ['نبيتي'],
      imageFingerprint: 'a'.repeat(64),
      analysisVersion: 'outfit-intel-v2',
    },
  });
  assert.equal(ok.clientSaveId, shortId);
  assert.equal(ok.intelligence.imageFingerprint?.length, 64);

  // Live 400 root cause: μs + full SHA-256 > MaxLength(64)
  const legacyTooLong = `${Date.now() * 1000}${'a'.repeat(64)}`;
  assert.ok(legacyTooLong.length > 64);
  await assert.rejects(
    () =>
      accept({
        occasionId: 'university',
        clientSaveId: legacyTooLong,
        intelligence: {
          clothingTypeAr: 'فستان',
          styleTypeAr: 'يومي',
          dominantColorsAr: ['نبيتي'],
        },
      }),
    (error: unknown) => error instanceof BadRequestException,
  );

  console.log(JSON.stringify({ checks: 2, failed: 0, release: 'RC11' }));
}

void main();
