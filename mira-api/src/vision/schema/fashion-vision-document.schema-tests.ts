import assert from 'node:assert/strict';
import {
  buildSampleFashionVisionDocument,
  validateFashionVisionDocument,
} from './fashion-vision-document.validator';
import { resetFashionOntologyRegistryCache } from './fashion-ontology.registry';

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function runFashionVisionSchemaTests(): void {
  resetFashionOntologyRegistryCache();

  const valid = buildSampleFashionVisionDocument();
  assert.equal(validateFashionVisionDocument(valid).valid, true, 'sample doc valid');

  const validMinimal = clone(valid);
  validMinimal.semantics.accessories = [];
  validMinimal.fusion.conflicts = [];
  assert.equal(
    validateFashionVisionDocument(validMinimal).valid,
    true,
    'minimal valid',
  );

  const degraded = clone(valid);
  degraded.analysisGate = 'degraded';
  degraded.fusion.overallConfidence = 0.55;
  assert.equal(validateFashionVisionDocument(degraded).valid, true, 'degraded ok');

  const secondGarment = clone(valid);
  secondGarment.semantics.garments.push({
    categoryId: 'bottoms',
    typeId: 'pants',
    colors: ['navy_deep'],
    providerConfidence: 0.62,
  });
  assert.equal(
    validateFashionVisionDocument(secondGarment).valid,
    true,
    'two garments valid',
  );

  const withAccessory = clone(valid);
  withAccessory.semantics.accessories = [
    {
      categoryId: 'jewelry',
      typeId: 'jewelry',
      providerConfidence: 0.8,
    },
  ];
  assert.equal(
    validateFashionVisionDocument(withAccessory).valid,
    true,
    'accessory valid',
  );

  // ── 5 invalid payloads ──
  const missingVersion = clone(valid);
  delete (missingVersion as { schemaVersion?: string }).schemaVersion;
  assert.equal(
    validateFashionVisionDocument(missingVersion).valid,
    false,
    'missing schemaVersion',
  );

  const badCategory = clone(valid);
  badCategory.semantics.garments[0].categoryId = 'not_a_category';
  assert.equal(
    validateFashionVisionDocument(badCategory).valid,
    false,
    'bad categoryId',
  );

  const badColor = clone(valid);
  badColor.semantics.garments[0].colors = ['neon_pink_fake'];
  assert.equal(
    validateFashionVisionDocument(badColor).valid,
    false,
    'bad color id',
  );

  const emptyGarments = clone(valid);
  emptyGarments.semantics.garments = [];
  assert.equal(
    validateFashionVisionDocument(emptyGarments).valid,
    false,
    'empty garments',
  );

  const lowConfidenceProceed = clone(valid);
  lowConfidenceProceed.analysisGate = 'proceed';
  lowConfidenceProceed.fusion.overallConfidence = 0.2;
  assert.equal(
    validateFashionVisionDocument(lowConfidenceProceed).valid,
    false,
    'proceed with low confidence',
  );

  assert.equal(validateFashionVisionDocument(null).valid, false, 'null root');
  assert.equal(validateFashionVisionDocument('x').valid, false, 'string root');
}

if (require.main === module) {
  runFashionVisionSchemaTests();
  console.log('fashion-vision schema tests: OK (5 valid + 5 invalid)');
}
