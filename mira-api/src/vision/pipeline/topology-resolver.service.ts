import { Injectable } from '@nestjs/common';
import {
  GeometryPayload,
  GeometryTopology,
  RegionRole,
  SemanticsPayload,
  SilhouetteHint,
} from '../schema/fashion-vision-document.v1';

export interface TopologyResolveResult {
  topology: GeometryTopology;
  /** Audit trail — which signals contributed to the merge. */
  signals: string[];
}

const ONE_PIECE_TYPES = new Set(['dress', 'abaya', 'jumpsuit', 'gown']);
const OUTERWEAR_TYPES = new Set(['blazer', 'jacket', 'coat', 'abaya']);
const UPPER_TYPES = new Set(['shirt', 'blouse', 'top', 'blazer', 'jacket', 'coat', 'sweater']);
const LOWER_TYPES = new Set(['pants', 'jeans', 'skirt', 'shorts']);

function segmentRoles(geometry: GeometryPayload): Set<RegionRole> {
  return new Set(geometry.segments.map((s) => s.regionRole));
}

function garmentTypes(semantics: SemanticsPayload): Set<string> {
  return new Set(semantics.garments.map((g) => g.typeId));
}

function garmentCategories(semantics: SemanticsPayload): Set<string> {
  return new Set(semantics.garments.map((g) => g.categoryId));
}

function isSemanticTwoPiece(semantics: SemanticsPayload): boolean {
  const categories = garmentCategories(semantics);
  if (categories.has('tops') && categories.has('bottoms')) return true;

  const types = garmentTypes(semantics);
  const hasLower = [...types].some((t) => LOWER_TYPES.has(t));
  const hasUpper = [...types].some((t) => UPPER_TYPES.has(t));
  if (hasLower && hasUpper) return true;

  return semantics.garments.length >= 2 && ![...types].some((t) => ONE_PIECE_TYPES.has(t));
}

function isSemanticOnePiece(semantics: SemanticsPayload): boolean {
  const types = garmentTypes(semantics);
  const hasOnePiece = [...types].some((t) => ONE_PIECE_TYPES.has(t));
  if (hasOnePiece && !isSemanticTwoPiece(semantics)) return true;
  return semantics.garments.length === 1 && hasOnePiece;
}

function isSemanticLayered(semantics: SemanticsPayload): boolean {
  const types = garmentTypes(semantics);
  const hasOuter = [...types].some((t) => OUTERWEAR_TYPES.has(t));
  const hasLower = [...types].some((t) => LOWER_TYPES.has(t));
  const hasInnerUpper = [...types].some(
    (t) => UPPER_TYPES.has(t) && !OUTERWEAR_TYPES.has(t),
  );
  if (hasOuter && hasLower && hasInnerUpper) return true;
  if (semantics.layering.length >= 2 && semantics.garments.length >= 3) return true;
  return false;
}

function isGeometryLayered(geometry: GeometryPayload, roles: Set<RegionRole>): boolean {
  if (geometry.topology.silhouetteHint === 'layered') return true;
  if (roles.has('outerwear') && roles.has('upper') && roles.has('lower')) return true;
  if (roles.has('outerwear') && roles.has('upper')) return true;
  return false;
}

function hintToTopology(
  hint: SilhouetteHint,
  geometry: GeometryPayload,
  signals: string[],
): GeometryTopology {
  const segmentCount = geometry.segments.length;
  if (hint === 'one_piece') {
    signals.push('resolved:one_piece');
    return {
      pieceCount: 1,
      onePiece: true,
      silhouetteHint: 'one_piece',
    };
  }
  if (hint === 'layered') {
    signals.push('resolved:layered');
    return {
      pieceCount: Math.max(3, segmentCount),
      onePiece: false,
      silhouetteHint: 'layered',
    };
  }
  if (hint === 'two_piece') {
    signals.push('resolved:two_piece');
    return {
      pieceCount: Math.max(2, segmentCount >= 3 ? 2 : segmentCount),
      onePiece: false,
      silhouetteHint: 'two_piece',
    };
  }
  signals.push('resolved:unknown');
  return {
    pieceCount: Math.max(1, segmentCount),
    onePiece: geometry.topology.onePiece,
    silhouetteHint: 'unknown',
  };
}

/** Infer silhouette from OpenAI semantics — mirrors Q4 taxonomy. */
export function inferSemanticSilhouette(semantics: SemanticsPayload): SilhouetteHint {
  if (isSemanticLayered(semantics)) return 'layered';
  if (isSemanticOnePiece(semantics)) return 'one_piece';
  if (isSemanticTwoPiece(semantics)) return 'two_piece';
  return 'unknown';
}

/** Infer silhouette from FASHN segment roles when provider hint is unknown. */
export function inferGeometrySilhouette(geometry: GeometryPayload): SilhouetteHint {
  const roles = segmentRoles(geometry);
  if (roles.has('full_body')) return 'one_piece';
  if (isGeometryLayered(geometry, roles)) return 'layered';
  if (roles.has('upper') && roles.has('lower')) return 'two_piece';
  if (geometry.topology.silhouetteHint !== 'unknown') return geometry.topology.silhouetteHint;
  if (geometry.topology.onePiece) return 'one_piece';
  return 'unknown';
}

/**
 * Merge FASHN geometry + OpenAI semantics into a single topology (Q4 perception).
 * Reference: docs/mira-q4-perception-taxonomy.js · mira-vision-platform.html#atelier-q4-perception
 */
export function mergeTopology(
  geometry: GeometryPayload,
  semantics: SemanticsPayload,
): TopologyResolveResult {
  const signals: string[] = [];
  const roles = segmentRoles(geometry);
  const geoHint = inferGeometrySilhouette(geometry);
  const semHint = inferSemanticSilhouette(semantics);

  if (geoHint !== 'unknown') signals.push(`geometry:${geoHint}`);
  if (semHint !== 'unknown') signals.push(`semantics:${semHint}`);

  if (roles.has('full_body')) signals.push('segment:full_body');

  if (roles.has('full_body')) {
    return { topology: hintToTopology('one_piece', geometry, signals), signals };
  }

  if (isGeometryLayered(geometry, roles)) {
    return { topology: hintToTopology('layered', geometry, signals), signals };
  }
  if (isSemanticLayered(semantics)) {
    return { topology: hintToTopology('layered', geometry, signals), signals };
  }

  if (geoHint === semHint && geoHint !== 'unknown') {
    return { topology: hintToTopology(geoHint, geometry, signals), signals };
  }

  if (geoHint === 'one_piece' || roles.has('full_body')) {
    return { topology: hintToTopology('one_piece', geometry, signals), signals };
  }
  if (semHint === 'one_piece' && !isSemanticTwoPiece(semantics)) {
    return { topology: hintToTopology('one_piece', geometry, signals), signals };
  }

  if (geoHint === 'two_piece' || (roles.has('upper') && roles.has('lower'))) {
    return { topology: hintToTopology('two_piece', geometry, signals), signals };
  }
  if (semHint === 'two_piece') {
    return { topology: hintToTopology('two_piece', geometry, signals), signals };
  }

  if (geoHint !== 'unknown') {
    return { topology: hintToTopology(geoHint, geometry, signals), signals };
  }
  if (semHint !== 'unknown') {
    return { topology: hintToTopology(semHint, geometry, signals), signals };
  }

  return {
    topology: {
      pieceCount: Math.max(1, geometry.segments.length),
      onePiece: geometry.topology.onePiece,
      silhouetteHint: 'unknown',
    },
    signals,
  };
}

@Injectable()
export class TopologyResolverService {
  resolve(geometry: GeometryPayload, semantics: SemanticsPayload): TopologyResolveResult {
    return mergeTopology(geometry, semantics);
  }
}
