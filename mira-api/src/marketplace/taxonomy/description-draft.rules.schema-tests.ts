import assert from 'node:assert/strict';
import {
  composeDescriptionFromPhrases,
  markDescriptionEdited,
  onSubcategoryChange,
} from './description-draft.rules';

{
  const text = composeDescriptionFromPhrases(
    ['jr1', 'jr2'],
    [
      { id: 'jr1', textAr: 'خاتم أنيق' },
      { id: 'jr2', textAr: 'مناسب للإهداء' },
      { id: 'jr3', textAr: 'عيار ٢١' },
    ],
    'متوفر بعدة مقاسات.',
  );
  assert.equal(text, 'خاتم أنيق مناسب للإهداء متوفر بعدة مقاسات.');
  assert.ok(!text.includes('عيار'));
}

{
  const prev = markDescriptionEdited(
    { descriptionAr: '', descriptionPhraseIds: ['jr1'], descriptionDirty: false },
    'نص يدوي كامل',
  );
  const next = onSubcategoryChange(prev, [
    { id: 'jn1', textAr: 'قلادة ناعمة' },
  ]);
  assert.equal(next.replaced, false);
  assert.equal(next.state.descriptionAr, 'نص يدوي كامل');
  assert.equal(next.state.descriptionDirty, true);
  assert.equal(next.availablePhrases[0].id, 'jn1');
}

console.log(JSON.stringify({ ok: true, id: 'DESCRIPTION_DRAFT_RULES' }));
