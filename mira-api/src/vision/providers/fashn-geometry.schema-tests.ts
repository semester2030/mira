import assert from 'node:assert/strict';
import {
  assertNoForbiddenFashnFields,
  runGeometryQualityGate,
  validateGeometryPayload,
} from '../pipeline/geometry-quality-gate.service';
import {
  buildMockFashnGeometryResponse,
  parseFashnGeometryResponse,
} from '../providers/fashn-geometry.parser';

function testValidMockGeometryPassesGate(): void {
  const raw = buildMockFashnGeometryResponse();
  const geometry = parseFashnGeometryResponse(raw);
  const gate = runGeometryQualityGate(raw, geometry);
  assert.equal(gate.valid, true, 'mock geometry passes gate');
  assert.equal(geometry.segments.length, 2);
  assert.equal(geometry.topology.silhouetteHint, 'two_piece');
}

function testForbiddenCompatibilityScoreRejected(): void {
  const raw = {
    ...buildMockFashnGeometryResponse(),
    compatibilityScore: 82,
  };
  const errors = assertNoForbiddenFashnFields(raw);
  assert.ok(errors.length > 0, 'compatibilityScore forbidden');
  assert.ok(errors.some((e) => e.code === 'FORBIDDEN_FIELD'));
}

function testForbiddenRecommendationRejected(): void {
  const raw = {
    segments: buildMockFashnGeometryResponse().segments,
    recommendations: ['wear navy'],
  };
  const errors = assertNoForbiddenFashnFields(raw);
  assert.ok(errors.length > 0);
}

function testEmptySegmentsFailsValidation(): void {
  const geometry = parseFashnGeometryResponse(buildMockFashnGeometryResponse());
  const bad = { ...geometry, segments: [] };
  const result = validateGeometryPayload(bad);
  assert.equal(result.valid, false);
}

function testInvalidBboxFailsValidation(): void {
  const geometry = parseFashnGeometryResponse(buildMockFashnGeometryResponse());
  geometry.segments[0].bbox = { x: 0, y: 0, w: 1.5, h: 0.2 };
  const result = validateGeometryPayload(geometry);
  assert.equal(result.valid, false);
}

function testParseInfersTopologyWhenMissing(): void {
  const raw = {
    segments: [
      {
        id: 'a',
        regionRole: 'upper',
        bbox: { x: 0.2, y: 0.1, w: 0.6, h: 0.35 },
      },
      {
        id: 'b',
        regionRole: 'lower',
        bbox: { x: 0.25, y: 0.5, w: 0.5, h: 0.4 },
      },
    ],
  };
  const geometry = parseFashnGeometryResponse(raw);
  assert.equal(geometry.topology.silhouetteHint, 'two_piece');
}

export function runFashnGeometryTests(): void {
  testValidMockGeometryPassesGate();
  testForbiddenCompatibilityScoreRejected();
  testForbiddenRecommendationRejected();
  testEmptySegmentsFailsValidation();
  testInvalidBboxFailsValidation();
  testParseInfersTopologyWhenMissing();
}

if (require.main === module) {
  runFashnGeometryTests();
  console.log('fashn-geometry tests: OK');
}
