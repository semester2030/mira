import assert from 'node:assert/strict';
import { buildMockFashnGeometryResponse, parseFashnGeometryResponse } from '../providers/fashn-geometry.parser';
import {
  buildMockOpenAiSemanticResponse,
  parseOpenAiSemanticResponse,
} from '../providers/openai-semantic.parser';
import { buildFashionVisionDocumentFromParts } from '../schema/fashion-vision-document.builder';
import { validateFashionVisionDocument } from '../schema/fashion-vision-document.validator';
import {
  BLOCKED_UX_MESSAGE_AR,
  ConfidenceEngineService,
  PROCEED_THRESHOLD,
} from './confidence-engine.service';
import { ConflictResolverService } from './conflict-resolver.service';

function baseGeometry() {
  return parseFashnGeometryResponse(buildMockFashnGeometryResponse());
}

function baseSemantics() {
  return parseOpenAiSemanticResponse(buildMockOpenAiSemanticResponse());
}

function testRuleOnePieceVsTwoPieceBlocked(): void {
  const resolver = new ConflictResolverService();
  const geometry = baseGeometry();
  geometry.topology.onePiece = true;
  geometry.topology.silhouetteHint = 'one_piece';

  const semantics = baseSemantics();
  semantics.garments[0].categoryId = 'tops';
  semantics.garments[0].typeId = 'shirt';
  semantics.garments.push({
    categoryId: 'bottoms',
    typeId: 'pants',
    colors: ['black_pure'],
    providerConfidence: 0.75,
  });

  const result = resolver.resolve(geometry, semantics);
  assert.ok(
    result.conflicts.some((c) => c.code === 'CONFLICT_ONE_PIECE_VS_TWO_PIECE'),
    'one-piece vs two-piece conflict recorded',
  );
  assert.equal(result.hasCriticalConflict, true);
  assert.equal(result.suggestedGate, 'blocked');
}

function testRuleBlazerVsDressConflict(): void {
  const resolver = new ConflictResolverService();
  const semantics = baseSemantics();
  semantics.garments.push({
    categoryId: 'tops',
    typeId: 'dress',
    colors: ['ivory_warm'],
    providerConfidence: 0.8,
  });

  const result = resolver.resolve(baseGeometry(), semantics);
  assert.ok(result.conflicts.some((c) => c.code === 'CONFLICT_BLAZER_VS_DRESS'));
}

function testRuleBlazerJacketUnifies(): void {
  const resolver = new ConflictResolverService();
  const semantics = baseSemantics();
  semantics.garments.push({
    categoryId: 'outerwear',
    typeId: 'jacket',
    colors: ['navy_deep'],
    providerConfidence: 0.6,
  });

  const result = resolver.resolve(baseGeometry(), semantics);
  const unify = result.conflicts.find((c) => c.code === 'CONFLICT_OUTERWEAR_UNIFIED');
  assert.ok(unify, 'unify conflict recorded');
  assert.equal(unify?.severity, 'low');

  const outerTypes = new Set(result.semantics.garments.map((g) => g.typeId));
  assert.equal(outerTypes.has('blazer') && outerTypes.has('jacket'), false);
  assert.ok(outerTypes.has('blazer') || outerTypes.has('jacket'));
}

function testConfidenceProceedAtThreshold(): void {
  const engine = new ConfidenceEngineService();
  const geometry = baseGeometry();
  const semantics = baseSemantics();
  semantics.garments[0].providerConfidence = 0.9;

  const result = engine.compute({
    geometry,
    semantics,
    conflicts: [],
    resolvedGarments: [
      {
        categoryId: semantics.garments[0].categoryId,
        typeId: semantics.garments[0].typeId,
        confidence: 0.9,
      },
    ],
    hasCriticalConflict: false,
    upstreamGate: 'proceed',
  });

  assert.ok(result.fusion.overallConfidence >= PROCEED_THRESHOLD);
  assert.equal(result.analysisGate, 'proceed');
}

function testConfidenceBlockedWithCriticalConflict(): void {
  const engine = new ConfidenceEngineService();
  const semantics = baseSemantics();

  const result = engine.compute({
    geometry: baseGeometry(),
    semantics,
    conflicts: [
      {
        code: 'CONFLICT_ONE_PIECE_VS_TWO_PIECE',
        message: 'critical',
        severity: 'high',
      },
    ],
    resolvedGarments: [],
    hasCriticalConflict: true,
    upstreamGate: 'proceed',
  });

  assert.equal(result.analysisGate, 'blocked');
  assert.equal(result.userMessageAr, BLOCKED_UX_MESSAGE_AR);
}

function testConflictsPersistInFashionVisionDocument(): void {
  const resolver = new ConflictResolverService();
  const geometry = baseGeometry();
  geometry.topology.onePiece = true;
  geometry.topology.silhouetteHint = 'one_piece';

  const semantics = baseSemantics();
  semantics.garments[0].categoryId = 'tops';
  semantics.garments.push({
    categoryId: 'bottoms',
    typeId: 'pants',
    colors: ['black_pure'],
    providerConfidence: 0.7,
  });

  const conflict = resolver.resolve(geometry, semantics);
  const engine = new ConfidenceEngineService();
  const confidence = engine.compute({
    geometry,
    semantics: conflict.semantics,
    conflicts: conflict.conflicts,
    resolvedGarments: conflict.resolvedGarments,
    hasCriticalConflict: conflict.hasCriticalConflict,
    upstreamGate: conflict.suggestedGate,
  });

  const doc = buildFashionVisionDocumentFromParts({
    geometry,
    semantics: conflict.semantics,
    providers: ['fashn-geometry', 'openai-semantic', 'pipeline-phase-6'],
    analysisGate: confidence.analysisGate,
    pipelinePhase: '6-conflict-confidence',
    fusion: confidence.fusion,
  });

  assert.ok(doc.fusion.conflicts.length > 0);
  const validation = validateFashionVisionDocument(doc);
  assert.equal(validation.valid, true, JSON.stringify(validation.errors));
}

export function runConflictConfidenceTests(): void {
  testRuleOnePieceVsTwoPieceBlocked();
  testRuleBlazerVsDressConflict();
  testRuleBlazerJacketUnifies();
  testConfidenceProceedAtThreshold();
  testConfidenceBlockedWithCriticalConflict();
  testConflictsPersistInFashionVisionDocument();
}

if (require.main === module) {
  runConflictConfidenceTests();
  console.log('conflict-confidence tests: OK (3 conflict rules + confidence engine)');
}
