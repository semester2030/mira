import assert from 'node:assert/strict';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { sanitizeOutfitIntelligence } from './outfit-analysis.service';
import { SaveOutfitSnapshotDto } from './dto/save-outfit-snapshot.dto';
import {
  answerStaysInScope,
  decideConsultationScope,
  historyForBeautyTurn,
  requestedOutcome,
} from '../consultation/services/consultation-scope';

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

async function accept(body: Record<string, unknown>): Promise<SaveOutfitSnapshotDto> {
  return pipe.transform(body, { type: 'body', metatype: SaveOutfitSnapshotDto });
}

async function main(): Promise<void> {
  const withSaveId = await accept({
    occasionId: 'eid',
    clientSaveId: 'save-burgundy-1',
    intelligence: {
      clothingTypeAr: 'فستان',
      styleTypeAr: 'سهرة',
      dominantColorsAr: ['عنابي'],
      imageFingerprint: 'fp-burgundy',
      analysisVersion: 'outfit-intel-v2',
    },
  });
  assert.equal(withSaveId.clientSaveId, 'save-burgundy-1');
  assert.equal(withSaveId.intelligence.dominantColorsAr[0], 'عنابي');

  const blue = await accept({
    occasionId: 'eid',
    clientSaveId: 'save-blue-1',
    intelligence: {
      clothingTypeAr: 'فستان',
      styleTypeAr: 'سهرة',
      dominantColorsAr: ['أزرق فاتح'],
      imageFingerprint: 'fp-blue',
      analysisVersion: 'outfit-intel-v2',
    },
  });
  assert.equal(blue.intelligence.dominantColorsAr[0], 'أزرق فاتح');

  const noScore = sanitizeOutfitIntelligence({
    clothingTypeAr: 'فستان',
    styleTypeAr: 'سهرة',
    dominantColorsAr: [],
    compatibilityScore: 75,
  });
  assert.equal(noScore.compatibilityScore, undefined);

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

  assert.equal(requestedOutcome('صف الصقر ومزاداته'), 'other');
  assert.equal(requestedOutcome('ما كود لون الفستان؟'), 'beauty');
  assert.equal(requestedOutcome('استوحي ألوان إطلالة من صورة طائر'), 'beauty');
  assert.equal(decideConsultationScope('صف القطة').allow, false);

  const history = [
    { role: 'user' as const, content: 'صف الصقر ومزاداته' },
    { role: 'assistant' as const, content: 'هذا خارج اختصاص ميرا. أقدر أساعدك في الجمال' },
    { role: 'user' as const, content: 'ما اللون الأنسب للحذاء؟' },
  ];
  const cleaned = historyForBeautyTurn(history);
  assert.equal(cleaned.length, 1);
  assert.equal(cleaned[0].content, 'ما اللون الأنسب للحذاء؟');
  assert.equal(answerStaysInScope('هذا صقر جميل يناسب الحذاء', 'ما اللون الأنسب للحذاء؟'), false);
  assert.equal(answerStaysInScope('جرّبي حذاء كحلي مع الفستان', 'ما اللون الأنسب للحذاء؟'), true);

  console.log(JSON.stringify({ checks: 12, failed: 0, release: 'RC10' }));
}

void main();
