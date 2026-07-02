import assert from 'node:assert/strict';
import {
  buildMockFashnGeometryResponse,
  parseFashnGeometryResponse,
} from '../providers/fashn-geometry.parser';
import {
  buildMockOpenAiSemanticResponse,
  parseOpenAiSemanticResponse,
} from '../providers/openai-semantic.parser';
import {
  inferSemanticSilhouette,
  mergeTopology,
  TopologyResolverService,
} from './topology-resolver.service';

function baseGeometry() {
  return parseFashnGeometryResponse(buildMockFashnGeometryResponse());
}

function baseSemantics() {
  return parseOpenAiSemanticResponse(buildMockOpenAiSemanticResponse());
}

function testDressSemanticsOnePiece(): void {
  const semantics = baseSemantics();
  semantics.garments = [
    {
      categoryId: 'dresses',
      typeId: 'dress',
      colors: ['navy_deep'],
      providerConfidence: 0.9,
    },
  ];
  assert.equal(inferSemanticSilhouette(semantics), 'one_piece');
}

function testTopsBottomsTwoPiece(): void {
  const semantics = baseSemantics();
  semantics.garments = [
    {
      categoryId: 'tops',
      typeId: 'blouse',
      colors: ['ivory_warm'],
      providerConfidence: 0.85,
    },
    {
      categoryId: 'bottoms',
      typeId: 'pants',
      colors: ['black_pure'],
      providerConfidence: 0.82,
    },
  ];
  assert.equal(inferSemanticSilhouette(semantics), 'two_piece');
}

function testLayeredJacketBlousePants(): void {
  const semantics = baseSemantics();
  semantics.garments = [
    {
      categoryId: 'outerwear',
      typeId: 'jacket',
      colors: ['black_pure'],
      providerConfidence: 0.8,
    },
    {
      categoryId: 'tops',
      typeId: 'blouse',
      colors: ['white_soft'],
      providerConfidence: 0.78,
    },
    {
      categoryId: 'bottoms',
      typeId: 'pants',
      colors: ['navy_deep'],
      providerConfidence: 0.77,
    },
  ];
  semantics.layering = ['base', 'mid', 'outer'];
  assert.equal(inferSemanticSilhouette(semantics), 'layered');
}

function testMergePrefersFullBodySegment(): void {
  const geometry = baseGeometry();
  geometry.segments[0].regionRole = 'full_body';
  geometry.topology = {
    pieceCount: 1,
    onePiece: true,
    silhouetteHint: 'one_piece',
  };

  const semantics = baseSemantics();
  semantics.garments.push({
    categoryId: 'bottoms',
    typeId: 'pants',
    colors: ['black_pure'],
    providerConfidence: 0.7,
  });

  const result = mergeTopology(geometry, semantics);
  assert.equal(result.topology.silhouetteHint, 'one_piece');
  assert.equal(result.topology.onePiece, true);
  assert.ok(result.signals.some((s) => s.includes('full_body')));
}

function testMergeTwoPieceFromRoles(): void {
  const geometry = baseGeometry();
  geometry.segments.push({
    id: 'seg-lower',
    regionRole: 'lower',
    polygon: [[0.2, 0.5], [0.8, 0.5], [0.8, 0.95], [0.2, 0.95]],
    bbox: { x: 0.2, y: 0.5, w: 0.6, h: 0.45 },
  });
  geometry.topology = {
    pieceCount: 2,
    onePiece: false,
    silhouetteHint: 'two_piece',
  };

  const semantics = baseSemantics();
  const result = mergeTopology(geometry, semantics);
  assert.equal(result.topology.silhouetteHint, 'two_piece');
  assert.equal(result.topology.pieceCount, 2);
}

function testServiceResolve(): void {
  const service = new TopologyResolverService();
  const result = service.resolve(baseGeometry(), baseSemantics());
  assert.ok(['one_piece', 'two_piece', 'layered', 'unknown'].includes(result.topology.silhouetteHint));
}

function run(): void {
  testDressSemanticsOnePiece();
  testTopsBottomsTwoPiece();
  testLayeredJacketBlousePants();
  testMergePrefersFullBodySegment();
  testMergeTwoPieceFromRoles();
  testServiceResolve();
  console.log('topology-resolver.schema-tests: OK');
}

run();
