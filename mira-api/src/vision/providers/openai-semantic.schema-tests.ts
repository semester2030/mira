import assert from 'node:assert/strict';
import { buildMockFashnGeometryResponse, parseFashnGeometryResponse } from './fashn-geometry.parser';
import {
  buildMockOpenAiSemanticResponse,
  parseOpenAiSemanticResponse,
} from './openai-semantic.parser';
import {
  assertNoForbiddenOpenAiFields,
  runSemanticQualityGate,
  validateSemanticsPayload,
} from '../pipeline/semantic-quality-gate.service';
import { buildFashionVisionDocumentFromParts } from '../schema/fashion-vision-document.builder';
import { validateFashionVisionDocument } from '../schema/fashion-vision-document.validator';
import { buildOpenAiSemanticsJsonSchema } from './openai-semantic.response-schema';

function testValidMockSemanticsPassesGate(): void {
  const raw = buildMockOpenAiSemanticResponse();
  const semantics = parseOpenAiSemanticResponse(raw);
  const gate = runSemanticQualityGate(raw, semantics);
  assert.equal(gate.valid, true, 'mock semantics passes gate');
  assert.equal(semantics.garments.length, 1);
  assert.equal(semantics.styleArchetypeId, 'business');
}

function testForbiddenCompatibilityScoreRejected(): void {
  const raw = {
    ...buildMockOpenAiSemanticResponse(),
    compatibilityScore: 90,
  };
  const errors = assertNoForbiddenOpenAiFields(raw);
  assert.ok(errors.length > 0);
  assert.ok(errors.some((e) => e.code === 'FORBIDDEN_FIELD'));
}

function testForbiddenRecommendationsRejected(): void {
  const raw = {
    ...buildMockOpenAiSemanticResponse(),
    recommendations: ['add a belt'],
  };
  const errors = assertNoForbiddenOpenAiFields(raw);
  assert.ok(errors.length > 0);
}

function testEmptyGarmentsFailsValidation(): void {
  const semantics = parseOpenAiSemanticResponse(buildMockOpenAiSemanticResponse());
  const bad = { ...semantics, garments: [] };
  const result = validateSemanticsPayload(bad);
  assert.equal(result.valid, false);
}

function testJsonSchemaHasNoScoreFields(): void {
  const schema = buildOpenAiSemanticsJsonSchema();
  const serialized = JSON.stringify(schema.schema);
  assert.ok(!serialized.includes('compatibilityScore'));
  assert.ok(!serialized.includes('recommendations'));
  assert.equal(schema.strict, true);
}

function testMockSemanticsBuildsValidFashionVisionDocument(): void {
  const geometry = parseFashnGeometryResponse(buildMockFashnGeometryResponse());
  const semantics = parseOpenAiSemanticResponse(buildMockOpenAiSemanticResponse());
  const doc = buildFashionVisionDocumentFromParts({
    geometry,
    semantics,
    providers: ['fashn-geometry', 'openai-semantic'],
  });
  const validation = validateFashionVisionDocument(doc);
  assert.equal(validation.valid, true, JSON.stringify(validation.errors));
  assert.equal(doc.provenance.providers.includes('openai-semantic'), true);
}

export function runOpenAiSemanticTests(): void {
  testValidMockSemanticsPassesGate();
  testForbiddenCompatibilityScoreRejected();
  testForbiddenRecommendationsRejected();
  testEmptyGarmentsFailsValidation();
  testJsonSchemaHasNoScoreFields();
  testMockSemanticsBuildsValidFashionVisionDocument();
}

if (require.main === module) {
  runOpenAiSemanticTests();
  console.log('openai-semantic tests: OK');
}
