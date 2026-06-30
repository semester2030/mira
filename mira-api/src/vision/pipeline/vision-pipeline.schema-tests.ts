import assert from 'node:assert/strict';
import { buildMockFashnGeometryResponse, parseFashnGeometryResponse } from '../providers/fashn-geometry.parser';
import {
  buildMockOpenAiSemanticResponse,
  parseOpenAiSemanticResponse,
} from '../providers/openai-semantic.parser';
import {
  applyConfidenceMultiplier,
  buildFashionVisionDocumentFromParts,
} from '../schema/fashion-vision-document.builder';
import { validateFashionVisionDocument } from '../schema/fashion-vision-document.validator';
import { FashionNormalizerService } from './fashion-normalizer.service';
import { FashionValidatorService } from './fashion-validator.service';
import { QualityGateService } from './quality-gate.service';

function buildValidDocument() {
  const geometry = parseFashnGeometryResponse(buildMockFashnGeometryResponse());
  const semantics = parseOpenAiSemanticResponse(buildMockOpenAiSemanticResponse());
  return buildFashionVisionDocumentFromParts({
    geometry,
    semantics,
    providers: ['fashn-geometry', 'openai-semantic'],
    analysisGate: 'proceed',
    pipelinePhase: '5-pipeline-guard',
  });
}

function testNormalizerMapsFreeTextType(): void {
  const normalizer = new FashionNormalizerService();
  const semantics = parseOpenAiSemanticResponse(buildMockOpenAiSemanticResponse());
  semantics.garments[0].typeId = 'Blazers';
  const result = normalizer.normalizeSemantics(semantics);
  assert.equal(result.semantics.garments[0].typeId, 'blazer');
  assert.ok(result.notes.some((n) => n.includes('typeId mapped')));
}

function testNormalizerMapsColorAlias(): void {
  const normalizer = new FashionNormalizerService();
  const semantics = parseOpenAiSemanticResponse(buildMockOpenAiSemanticResponse());
  semantics.garments[0].colors = ['black'];
  semantics.dominantColorIds = ['black'];
  const result = normalizer.normalizeSemantics(semantics);
  assert.equal(result.semantics.garments[0].colors[0], 'black_pure');
  assert.equal(result.semantics.dominantColorIds[0], 'black_pure');
}

function testQualityGateRejectsMissingSchemaVersion(): void {
  const gate = new QualityGateService();
  const doc = buildValidDocument();
  const bad = { ...doc, schemaVersion: undefined } as unknown as typeof doc;
  const result = gate.run(bad);
  assert.equal(result.valid, false);
  assert.ok(result.rejectReasons.some((e) => e.code === 'SCHEMA_VERSION_MISSING'));
}

function testFashionRuleDominantColorMismatch(): void {
  const validator = new FashionValidatorService();
  const doc = buildValidDocument();
  doc.semantics.dominantColorIds = ['navy_deep'];
  const result = validator.validate(doc);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.code === 'RULE_DOMINANT_COLOR_MISMATCH'));
}

function testFashionRuleTopologyConflict(): void {
  const validator = new FashionValidatorService();
  const doc = buildValidDocument();
  doc.geometry.topology.onePiece = true;
  doc.semantics.garments[0].categoryId = 'tops';
  doc.semantics.garments.push({
    categoryId: 'bottoms',
    typeId: 'pants',
    colors: ['black_pure'],
    providerConfidence: 0.7,
  });
  const result = validator.validate(doc);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.code === 'RULE_TOPOLOGY_CONFLICT'));
}

function testFashionRuleAccessoryCategory(): void {
  const validator = new FashionValidatorService();
  const doc = buildValidDocument();
  doc.semantics.accessories[0].categoryId = 'tops';
  const result = validator.validate(doc);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.code === 'RULE_ACCESSORY_CATEGORY'));
}

function testFashionRuleMinConfidence(): void {
  const validator = new FashionValidatorService();
  const doc = buildValidDocument();
  doc.semantics.garments.forEach((g) => {
    g.providerConfidence = 0.05;
  });
  const result = validator.validate(doc);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.code === 'RULE_MIN_CONFIDENCE'));
}

function testFashionRuleLayeringWarning(): void {
  const validator = new FashionValidatorService();
  const doc = buildValidDocument();
  doc.semantics.garments.push({
    categoryId: 'bottoms',
    typeId: 'pants',
    colors: ['black_pure'],
    providerConfidence: 0.7,
  });
  doc.semantics.layering = ['base'];
  doc.geometry.topology.onePiece = false;
  const result = validator.validate(doc);
  assert.equal(result.valid, true);
  assert.ok(result.warnings.some((w) => w.code === 'RULE_LAYERING_SHALLOW'));
  assert.equal(result.suggestedGate, 'degraded');
}

function testPipelineDocumentWithProvenanceAuditValidates(): void {
  const doc = buildValidDocument();
  doc.provenance.normalizationNotes = ['semantics.garments[0].typeId mapped Blazers → blazer'];
  doc.provenance.rejectReasons = [
    { code: 'RULE_LAYERING_SHALLOW', message: 'layering depth warning', path: 'semantics.layering' },
  ];
  const validation = validateFashionVisionDocument(doc);
  assert.equal(validation.valid, true, JSON.stringify(validation.errors));
}

function testApplyConfidenceMultiplier(): void {
  const semantics = parseOpenAiSemanticResponse(buildMockOpenAiSemanticResponse());
  const adjusted = applyConfidenceMultiplier(semantics, 0.5);
  assert.equal(adjusted.garments[0].providerConfidence, semantics.garments[0].providerConfidence * 0.5);
}

export function runVisionPipelineTests(): void {
  testNormalizerMapsFreeTextType();
  testNormalizerMapsColorAlias();
  testQualityGateRejectsMissingSchemaVersion();
  testFashionRuleDominantColorMismatch();
  testFashionRuleTopologyConflict();
  testFashionRuleAccessoryCategory();
  testFashionRuleMinConfidence();
  testFashionRuleLayeringWarning();
  testPipelineDocumentWithProvenanceAuditValidates();
  testApplyConfidenceMultiplier();
}

if (require.main === module) {
  runVisionPipelineTests();
  console.log('vision-pipeline tests: OK (5+ rules + normalizer + quality gate)');
}
