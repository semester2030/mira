import * as fs from 'fs';
import * as path from 'path';
import {
  FashionVisionDocument,
  GeometrySegment,
  RegionRole,
  SemanticGarment,
  ResolvedGarment,
  FieldConfidence,
} from '../../vision/schema/fashion-vision-document.v1';
import {
  fashionRuntime,
  toPublicFashionRuntime,
} from '../runtime/fashion-runtime-state';
import { FashionEntityClass } from '../models/canonical-wardrobe';
import {
  CanonicalGarment,
  FASHION_GARMENT_MAPPING_VERSION,
  garmentSchemaVersion,
} from './canonical-garment';
import { ClassificationEngine } from './classification-engine';
import { AttributeResolutionEngine } from './attribute-resolution-engine';
import { CatalogResolutionEngine } from './catalog-resolution-engine';
import { ConfidenceEngine } from './confidence-engine';
import { LimitationEngine } from './limitation-engine';
import { ExplainabilityEngine } from './explainability-engine';
import {
  deterministicGarmentId,
  deterministicMapTraceId,
  GARMENT_MAPPING_EPOCH_ISO,
  visionDocumentFingerprint,
} from './garment-identity';
import { normalizeCategoryId, normalizeColorId, normalizeTypeId } from './normalization-engine';

export interface GarmentMappingResult {
  garments: CanonicalGarment[];
  mappingVersion: string;
  runtime: ReturnType<typeof toPublicFashionRuntime>;
}

/**
 * Mapping Engine — FashionVisionDocument → CanonicalGarment[].
 * Phase 6C.1: deterministic identity, geometryRef, fusion fieldConfidence, robust pairing.
 */
export class GarmentMappingEngine {
  private readonly classification: ClassificationEngine;
  private readonly attributes: AttributeResolutionEngine;
  private readonly catalog: CatalogResolutionEngine;
  private readonly confidence: ConfidenceEngine;
  private readonly limitations: LimitationEngine;
  private readonly explain: ExplainabilityEngine;

  constructor(
    classification?: ClassificationEngine,
    attributes?: AttributeResolutionEngine,
    catalog?: CatalogResolutionEngine,
    confidence?: ConfidenceEngine,
    limitations?: LimitationEngine,
    explain?: ExplainabilityEngine,
  ) {
    this.classification = classification ?? new ClassificationEngine();
    this.attributes = attributes ?? new AttributeResolutionEngine();
    this.catalog = catalog ?? new CatalogResolutionEngine();
    this.confidence = confidence ?? new ConfidenceEngine();
    this.limitations = limitations ?? new LimitationEngine();
    this.explain = explain ?? new ExplainabilityEngine();
  }

  mapFromVisionDocument(
    doc: FashionVisionDocument,
    opts?: { traceId?: string },
  ): GarmentMappingResult {
    const fingerprint = visionDocumentFingerprint(doc);
    const traceId = opts?.traceId ?? deterministicMapTraceId(fingerprint);
    const now = GARMENT_MAPPING_EPOCH_ISO;
    const semantics = doc.semantics?.garments ?? [];
    const resolved = extractResolved(doc);
    const pairs = pairObservations(resolved, semantics);
    const garments: CanonicalGarment[] = [];
    const segments = doc.geometry?.segments ?? [];
    const fusionFields = doc.fusion?.fieldConfidence ?? [];

    const gateCodes: string[] = [];
    if (doc.analysisGate === 'degraded') gateCodes.push('analysis_gate_degraded');
    if (doc.analysisGate === 'blocked') gateCodes.push('analysis_gate_blocked');

    pairs.forEach((pair, index) => {
      garments.push(
        this.mapOne({
          index,
          slot: `g${index}`,
          resolved: pair.resolved,
          semantic: pair.semantic,
          fusionOverall: doc.fusion?.overallConfidence,
          fusionFields,
          styleArchetypeId: doc.semantics?.styleArchetypeId,
          gateCodes,
          now,
          traceId,
          segments,
        }),
      );
    });

    for (const [i, acc] of (doc.semantics?.accessories ?? []).entries()) {
      const classified = this.classification.classify({
        categoryId: acc.categoryId,
        typeId: acc.typeId,
      });
      const attrs = this.attributes.resolve({
        colors: acc.colors,
        styleHints: doc.semantics?.styleArchetypeId
          ? [doc.semantics.styleArchetypeId]
          : [],
      });
      const cat = this.catalog.resolve({
        categoryId: classified.categoryId,
        typeId: classified.typeId,
        colors: attrs.colors,
      });
      const limitationCodes = [
        ...gateCodes,
        ...classified.notes,
        ...attrs.limitationCodes,
        ...cat.limitationCodes,
      ];
      if (acc.providerConfidence < 0.5) {
        limitationCodes.push('provider_uncertain');
      }
      const conf = this.confidence.aggregate({
        fusionOverall: doc.fusion?.overallConfidence,
        providerConfidence: acc.providerConfidence,
        fieldConfidence: attrs.fieldConfidence,
        fusionFieldConfidence: fusionFields,
        classificationKnown: classified.knownCategory && classified.knownType,
        mappingComplete: classified.knownType,
      });
      const geometryRef = pickGeometryRef(
        segments,
        classified.categoryId,
        i + pairs.length,
      );
      const garmentId = deterministicGarmentId({
        slot: `a${i}`,
        categoryId: classified.categoryId,
        typeId: classified.typeId,
        colors: attrs.colors,
        material: attrs.material.value,
        fit: attrs.fit,
        segmentId: geometryRef?.segmentId,
      });
      const evidenceRefs = [
        `vision.semantics.accessories[${i}]`,
        `fusion.overall=${doc.fusion?.overallConfidence ?? 'n/a'}`,
      ];
      let season = attrs.season;
      let occasion = attrs.occasion;
      // Only attach catalog season/occasion on unambiguous catalog hit
      if (cat.catalogPieceId && !cat.limitationCodes.includes('catalog_ambiguous')) {
        const evidenced = readCatalogAttrs(cat.catalogPieceId);
        if (evidenced.season.length) {
          season = evidenced.season;
          removeCode(limitationCodes, 'season_not_evidenced');
        }
        if (evidenced.occasion.length) {
          occasion = evidenced.occasion;
          removeCode(limitationCodes, 'occasion_not_evidenced');
        }
      }
      garments.push(
        this.assemble({
          garmentId,
          classified,
          attrs: { ...attrs, season, occasion },
          catalogPieceId: cat.catalogPieceId,
          conf,
          limitationCodes,
          evidenceRefs,
          entityClass: classified.entityClass,
          availability: cat.catalogPieceId ? 'catalog' : 'detected',
          now,
          traceId,
          geometryRef,
        }),
      );
    }

    const status =
      doc.analysisGate === 'blocked'
        ? ('BLOCKED' as const)
        : doc.analysisGate === 'degraded' || garments.length === 0
          ? ('DEGRADED' as const)
          : garments.some((g) => g.limitations.length > 3)
            ? ('PARTIAL' as const)
            : ('AVAILABLE' as const);

    const runtime = toPublicFashionRuntime(
      fashionRuntime({
        status,
        stage: 'mapping',
        reasonCode: 'garment_mapping_complete',
        reasonEn: `Mapped ${garments.length} canonical garment(s).`,
        reasonAr: `تم تعيين ${garments.length} قطعة قانونية.`,
        capabilityId: 'analyze_garment',
        capabilityVersion: garmentSchemaVersion(),
        traceId,
      }),
    );

    return {
      garments,
      mappingVersion: FASHION_GARMENT_MAPPING_VERSION,
      runtime,
    };
  }

  private mapOne(input: {
    index: number;
    slot: string;
    resolved?: ResolvedGarment;
    semantic?: SemanticGarment;
    fusionOverall?: number;
    fusionFields: FieldConfidence[];
    styleArchetypeId?: string;
    gateCodes: string[];
    now: string;
    traceId: string;
    segments: GeometrySegment[];
  }): CanonicalGarment {
    const categoryId =
      input.resolved?.categoryId ?? input.semantic?.categoryId ?? 'unknown';
    const typeId = input.resolved?.typeId ?? input.semantic?.typeId ?? 'unknown';
    const classified = this.classification.classify({ categoryId, typeId });

    const attrs = this.attributes.resolve({
      colors: input.semantic?.colors,
      material: input.semantic?.material,
      materialConfidence: input.semantic?.providerConfidence,
      fit: input.semantic?.fit,
      sleeve: input.semantic?.sleeve,
      neckline: input.semantic?.neckline,
      styleHints: input.styleArchetypeId ? [input.styleArchetypeId] : [],
    });

    const cat = this.catalog.resolve({
      categoryId: classified.categoryId,
      typeId: classified.typeId,
      colors: attrs.colors,
    });

    const limitationCodes = [
      ...input.gateCodes,
      ...classified.notes,
      ...attrs.limitationCodes,
      ...cat.limitationCodes,
    ];
    if (
      input.semantic &&
      typeof input.semantic.providerConfidence === 'number' &&
      input.semantic.providerConfidence < 0.5
    ) {
      limitationCodes.push('provider_uncertain');
    }
    if (!input.resolved && !input.semantic) {
      limitationCodes.push('mapping_incomplete');
    }

    let season = attrs.season;
    let occasion = attrs.occasion;
    if (cat.catalogPieceId && !cat.limitationCodes.includes('catalog_ambiguous')) {
      const evidenced = readCatalogAttrs(cat.catalogPieceId);
      if (evidenced.season.length) {
        season = evidenced.season;
        removeCode(limitationCodes, 'season_not_evidenced');
      }
      if (evidenced.occasion.length) {
        occasion = evidenced.occasion;
        removeCode(limitationCodes, 'occasion_not_evidenced');
      }
    }

    const conf = this.confidence.aggregate({
      fusionOverall: input.fusionOverall ?? input.resolved?.confidence,
      providerConfidence: input.semantic?.providerConfidence,
      fieldConfidence: attrs.fieldConfidence,
      fusionFieldConfidence: input.fusionFields,
      classificationKnown: classified.knownCategory && classified.knownType,
      mappingComplete: !!(input.resolved || input.semantic),
    });

    const geometryRef = pickGeometryRef(
      input.segments,
      classified.categoryId,
      input.index,
    );

    const garmentId = deterministicGarmentId({
      slot: input.slot,
      categoryId: classified.categoryId,
      typeId: classified.typeId,
      colors: attrs.colors,
      material: attrs.material.value,
      fit: attrs.fit,
      segmentId: geometryRef?.segmentId,
    });

    const evidenceRefs = [
      input.resolved ? `fusion.resolvedGarments[${input.index}]` : '',
      input.semantic ? `semantics.garments[${input.index}]` : '',
      geometryRef?.segmentId ? `geometry.segments:${geometryRef.segmentId}` : '',
    ].filter(Boolean);

    return this.assemble({
      garmentId,
      classified,
      attrs: { ...attrs, season, occasion },
      catalogPieceId: cat.catalogPieceId,
      conf,
      limitationCodes,
      evidenceRefs,
      entityClass: classified.entityClass,
      availability: cat.catalogPieceId ? 'catalog' : 'detected',
      now: input.now,
      traceId: input.traceId,
      geometryRef,
    });
  }

  private assemble(input: {
    garmentId: string;
    classified: ReturnType<ClassificationEngine['classify']>;
    attrs: ReturnType<AttributeResolutionEngine['resolve']>;
    catalogPieceId?: string;
    conf: ReturnType<ConfidenceEngine['aggregate']>;
    limitationCodes: string[];
    evidenceRefs: string[];
    entityClass: FashionEntityClass;
    availability: CanonicalGarment['availability'];
    now: string;
    traceId: string;
    geometryRef?: CanonicalGarment['geometryRef'];
  }): CanonicalGarment {
    const limitationList = this.limitations.build(input.limitationCodes);
    const explainability = this.explain.build({
      garmentId: input.garmentId,
      categoryId: input.classified.categoryId,
      typeId: input.classified.typeId,
      limitationCodes: input.limitationCodes,
      evidenceRefs: input.evidenceRefs,
    });

    const status =
      input.classified.categoryId === 'unknown' &&
      input.classified.typeId === 'unknown'
        ? ('DEGRADED' as const)
        : input.limitationCodes.includes('mapping_incomplete')
          ? ('PARTIAL' as const)
          : ('AVAILABLE' as const);

    const runtime = toPublicFashionRuntime(
      fashionRuntime({
        status,
        stage: 'mapping',
        reasonCode: 'canonical_garment_built',
        reasonEn: 'Canonical garment produced from vision observations.',
        reasonAr: 'أُنتجت قطعة قانونية من ملاحظات الرؤية.',
        capabilityId: 'analyze_garment',
        capabilityVersion: garmentSchemaVersion(),
        traceId: input.traceId,
      }),
    );

    return {
      garmentId: input.garmentId,
      version: garmentSchemaVersion(),
      identity: {
        categoryId: input.classified.categoryId,
        subcategoryId: input.classified.subcategoryId,
        typeId: input.classified.typeId,
        catalogPieceId: input.catalogPieceId,
        entityClass: input.entityClass,
      },
      attributes: {
        colors: input.attrs.colors,
        pattern: input.attrs.pattern,
        material: input.attrs.material,
        fit: input.attrs.fit,
        season: input.attrs.season,
        occasion: input.attrs.occasion,
        styleHints: input.attrs.styleHints,
        sleeve: input.attrs.sleeve,
        neckline: input.attrs.neckline,
      },
      geometryRef: input.geometryRef,
      confidence: input.conf.overall,
      fieldConfidence: input.conf.fields,
      availability: input.availability,
      source: 'vision',
      limitations: limitationList,
      explainability,
      runtime,
      mappingVersion: FASHION_GARMENT_MAPPING_VERSION,
      createdAt: input.now,
      updatedAt: input.now,
    };
  }
}

function extractResolved(doc: FashionVisionDocument): ResolvedGarment[] {
  const fusion = doc.fusion?.resolvedGarments;
  if (Array.isArray(fusion) && fusion.length > 0) return fusion;
  const top = (doc as unknown as { resolvedGarments?: ResolvedGarment[] })
    .resolvedGarments;
  if (Array.isArray(top)) return top;
  return [];
}

/**
 * Robust pairing: match by normalized type+category first, then residual by order.
 * Preserves multi-garment order stability for unmatched leftovers.
 */
export function pairObservations(
  resolved: ResolvedGarment[],
  semantics: SemanticGarment[],
): Array<{ resolved?: ResolvedGarment; semantic?: SemanticGarment }> {
  const pairs: Array<{ resolved?: ResolvedGarment; semantic?: SemanticGarment }> =
    [];
  const usedSem = new Set<number>();
  const usedRes = new Set<number>();

  for (let ri = 0; ri < resolved.length; ri++) {
    const r = resolved[ri];
    const rCat = normalizeCategoryId(r.categoryId);
    const rType = normalizeTypeId(r.typeId);
    let match = -1;
    for (let si = 0; si < semantics.length; si++) {
      if (usedSem.has(si)) continue;
      const s = semantics[si];
      if (
        normalizeCategoryId(s.categoryId) === rCat &&
        normalizeTypeId(s.typeId) === rType
      ) {
        match = si;
        break;
      }
    }
    if (match >= 0) {
      usedSem.add(match);
      usedRes.add(ri);
      pairs.push({ resolved: r, semantic: semantics[match] });
    }
  }

  // Residual: preserve relative order
  const leftoverRes = resolved.filter((_, i) => !usedRes.has(i));
  const leftoverSem = semantics.filter((_, i) => !usedSem.has(i));
  const n = Math.max(leftoverRes.length, leftoverSem.length);
  for (let i = 0; i < n; i++) {
    pairs.push({
      resolved: leftoverRes[i],
      semantic: leftoverSem[i],
    });
  }

  if (pairs.length === 0 && (resolved.length > 0 || semantics.length > 0)) {
    const nFallback = Math.max(resolved.length, semantics.length);
    for (let i = 0; i < nFallback; i++) {
      pairs.push({ resolved: resolved[i], semantic: semantics[i] });
    }
  }

  return pairs;
}

function categoryToRegionRole(categoryId: string): RegionRole | undefined {
  const cat = normalizeCategoryId(categoryId);
  const map: Record<string, RegionRole> = {
    tops: 'upper',
    outerwear: 'outerwear',
    bottoms: 'lower',
    dresses: 'full_body',
    heels: 'feet',
    bags: 'accessory',
    jewelry: 'accessory',
    scarves: 'accessory',
    watches: 'accessory',
    sunglasses: 'accessory',
  };
  return map[cat];
}

export function pickGeometryRef(
  segments: GeometrySegment[],
  categoryId: string,
  index: number,
): CanonicalGarment['geometryRef'] | undefined {
  if (!segments.length) return undefined;
  const role = categoryToRegionRole(categoryId);
  const byRole =
    role != null ? segments.find((s) => s.regionRole === role) : undefined;
  const seg = byRole ?? segments[Math.min(index, segments.length - 1)];
  if (!seg) return undefined;
  return { segmentId: seg.id, regionRole: seg.regionRole };
}

function removeCode(codes: string[], code: string): void {
  const idx = codes.indexOf(code);
  if (idx >= 0) codes.splice(idx, 1);
}

function readCatalogAttrs(pieceId: string): {
  season: string[];
  occasion: string[];
} {
  try {
    const catalogPath = path.join(
      path.resolve(__dirname, '../../../..'),
      'assets/fashion/catalog.json',
    );
    const raw = JSON.parse(fs.readFileSync(catalogPath, 'utf8')) as {
      pieces?: Array<Record<string, unknown>>;
    };
    const piece = (raw.pieces ?? []).find((p) => p.id === pieceId);
    if (!piece) return { season: [], occasion: [] };
    const season = Array.isArray(piece.season)
      ? piece.season.map(String)
      : Array.isArray(piece.seasons)
        ? piece.seasons.map(String)
        : [];
    const occasion = Array.isArray(piece.occasion)
      ? piece.occasion.map(String)
      : Array.isArray(piece.occasions)
        ? piece.occasions.map(String)
        : [];
    return { season, occasion };
  } catch {
    return { season: [], occasion: [] };
  }
}

/** Exported for color-match robustness tests */
export function colorsCompatible(a?: string, b?: string): boolean {
  if (!a || !b) return true;
  const na = normalizeColorId(a);
  const nb = normalizeColorId(b);
  if (na === nb) return true;
  const stemA = na.split('_')[0] ?? na;
  const stemB = nb.split('_')[0] ?? nb;
  return stemA === stemB;
}
