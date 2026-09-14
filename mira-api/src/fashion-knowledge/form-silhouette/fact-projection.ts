/**
 * FK-7 — Safe fabric/silhouette/proportion fact + relationship projection.
 * Missing = UNKNOWN. No body-size volume. No CanonicalGarment mutation.
 * Layering: CONSUME_ONLY OI summary — never recompute legality.
 */
import { FASHION_KNOWLEDGE_FORM_FACT_VERSION } from '../versioning/release';
import {
  FabricEvidenceState,
  FabricSemanticFamily,
  SilhouetteVocabulary,
  TextureRelationship,
  VisualVolume,
  ProportionRelationship,
  LengthRelationship,
  VisualComplexity,
  EvidenceSufficiency,
} from './models';

export interface RawFormGarmentInput {
  readonly garmentId: string;
  readonly category?: string;
  readonly type?: string;
  readonly material?: string;
  readonly materialEvidence?: 'MEASURED' | 'SUPPORTED' | 'ESTIMATED' | 'UNKNOWN';
  readonly pattern?: string;
  readonly fit?: string;
  readonly silhouette?: string;
  readonly length?: string;
  readonly sleeve?: string;
  readonly neckline?: string;
  readonly styleHints?: readonly string[];
  readonly formalityHint?: string;
  readonly geometryRef?: string;
  readonly outfitSlot?: string;
  readonly colors?: readonly string[];
  readonly visualVolumeHint?: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  readonly fabricFamilyHint?: string;
  readonly evidenceRefs?: readonly string[];
  readonly confidence?: string;
}

export interface FashionFormGarmentFact {
  readonly schemaVersion: typeof FASHION_KNOWLEDGE_FORM_FACT_VERSION | string;
  readonly garmentId: string;
  readonly category?: string;
  readonly type?: string;
  readonly material?: string;
  readonly materialEvidence: string;
  readonly fabricFamily: string;
  readonly pattern?: string;
  readonly fit?: string;
  readonly silhouette: string;
  readonly length?: string;
  readonly sleeve?: string;
  readonly neckline?: string;
  readonly styleHints: readonly string[];
  readonly formalityHint?: string;
  readonly geometryRef?: string;
  readonly outfitSlot?: string;
  readonly colors: readonly string[];
  readonly visualVolume: string;
  readonly confidence?: string;
  readonly evidenceRefs: readonly string[];
  readonly limitations: readonly string[];
}

export interface FormRelationshipProjection {
  readonly schemaVersion: typeof FASHION_KNOWLEDGE_FORM_FACT_VERSION | string;
  readonly garmentFacts: readonly FashionFormGarmentFact[];
  readonly textureRelationship: string;
  readonly proportionRelationship: string;
  readonly lengthRelationship: string;
  readonly visualComplexity: string;
  readonly evidenceSufficiency: string;
  readonly layeringSummary?: string;
  readonly layeringEvidenceRefs: readonly string[];
  readonly oiLayeringBoundary: 'CONSUME_ONLY';
  readonly limitations: readonly string[];
  readonly explainability: {
    readonly inputFactIds: readonly string[];
    readonly relationshipNotes: readonly string[];
  };
}

const SIL_OK = new Set(Object.values(SilhouetteVocabulary));
const VOL_OK = new Set(Object.values(VisualVolume));
const FAM_OK = new Set(Object.values(FabricSemanticFamily));
const EV_OK = new Set(Object.values(FabricEvidenceState));

const VOLUME_HIGH = new Set([
  'OVERSIZED',
  'VOLUMINOUS',
  'FLARED',
  'A_LINE',
  'RELAXED',
]);
const VOLUME_LOW = new Set(['FITTED', 'COLUMN', 'STRAIGHT']);

function mapSilhouette(raw?: string): string {
  if (!raw) return SilhouetteVocabulary.UNKNOWN;
  const u = raw.toUpperCase().replace(/[-\s]/g, '_');
  if (SIL_OK.has(u as never)) return u;
  if (/oversize/i.test(raw)) return SilhouetteVocabulary.OVERSIZED;
  if (/wide.?leg|flare/i.test(raw)) return SilhouetteVocabulary.FLARED;
  if (/fit(ted)?/i.test(raw)) return SilhouetteVocabulary.FITTED;
  if (/relax|loose/i.test(raw)) return SilhouetteVocabulary.RELAXED;
  if (/a.?line/i.test(raw)) return SilhouetteVocabulary.A_LINE;
  return SilhouetteVocabulary.UNKNOWN;
}

function mapVolume(
  silhouette: string,
  hint?: string,
  fit?: string,
): string {
  if (hint && VOL_OK.has(hint as never)) return hint;
  if (VOLUME_HIGH.has(silhouette)) return VisualVolume.HIGH;
  if (VOLUME_LOW.has(silhouette)) return VisualVolume.LOW;
  if (fit && /oversize|wide|loose/i.test(fit)) return VisualVolume.HIGH;
  if (fit && /slim|fitted|tailored/i.test(fit)) return VisualVolume.LOW;
  if (silhouette === SilhouetteVocabulary.UNKNOWN && !fit) {
    return VisualVolume.UNKNOWN;
  }
  return VisualVolume.MEDIUM;
}

function mapFamily(hint?: string, material?: string): string {
  if (hint && FAM_OK.has(hint as never)) return hint;
  if (!material) return FabricSemanticFamily.UNKNOWN;
  const m = material.toLowerCase();
  if (/satin|silk|sheen|lustre|luster/i.test(m))
    return FabricSemanticFamily.LUSTROUS;
  if (/tweed|boucle|corduroy|knit.?texture|textur/i.test(m))
    return FabricSemanticFamily.TEXTURED;
  if (/chiffon|sheer|organza/i.test(m)) return FabricSemanticFamily.SHEER;
  if (/denim|wool|tweed|structured/i.test(m))
    return FabricSemanticFamily.STRUCTURED;
  if (/jersey|fluid|silk|satin|rayon/i.test(m))
    return FabricSemanticFamily.FLUID;
  return FabricSemanticFamily.UNKNOWN;
}

export function projectFormGarmentFact(
  input: RawFormGarmentInput,
): FashionFormGarmentFact {
  const silhouette = mapSilhouette(input.silhouette ?? input.fit);
  const materialEvidence =
    input.materialEvidence && EV_OK.has(input.materialEvidence as never)
      ? input.materialEvidence
      : input.material
        ? FabricEvidenceState.SUPPORTED
        : FabricEvidenceState.UNKNOWN;
  const fabricFamily = mapFamily(input.fabricFamilyHint, input.material);
  const visualVolume = mapVolume(
    silhouette,
    input.visualVolumeHint,
    input.fit,
  );
  const limitations: string[] = [];
  if (materialEvidence === FabricEvidenceState.ESTIMATED) {
    limitations.push('estimated_material_cannot_support_high_certainty');
  }
  if (materialEvidence === FabricEvidenceState.UNKNOWN && !input.material) {
    limitations.push('material_unknown');
  }
  if (silhouette === SilhouetteVocabulary.UNKNOWN) {
    limitations.push('silhouette_unknown');
  }

  return Object.freeze({
    schemaVersion: FASHION_KNOWLEDGE_FORM_FACT_VERSION,
    garmentId: input.garmentId,
    category: input.category,
    type: input.type,
    material: input.material,
    materialEvidence,
    fabricFamily,
    pattern: input.pattern,
    fit: input.fit,
    silhouette,
    length: input.length,
    sleeve: input.sleeve,
    neckline: input.neckline,
    styleHints: Object.freeze([...(input.styleHints ?? [])]),
    formalityHint: input.formalityHint,
    geometryRef: input.geometryRef,
    outfitSlot: input.outfitSlot,
    colors: Object.freeze([...(input.colors ?? [])]),
    visualVolume,
    confidence: input.confidence,
    evidenceRefs: Object.freeze([...(input.evidenceRefs ?? [])]),
    limitations: Object.freeze(limitations),
  });
}

function textureBetween(
  a: FashionFormGarmentFact,
  b: FashionFormGarmentFact,
): string {
  if (
    a.fabricFamily === FabricSemanticFamily.UNKNOWN ||
    b.fabricFamily === FabricSemanticFamily.UNKNOWN
  ) {
    return TextureRelationship.UNKNOWN;
  }
  if (a.fabricFamily === b.fabricFamily) return TextureRelationship.SIMILAR;
  const strong = new Set([
    FabricSemanticFamily.LUSTROUS,
    FabricSemanticFamily.TEXTURED,
    FabricSemanticFamily.STRUCTURED,
  ]);
  if (strong.has(a.fabricFamily as never) && strong.has(b.fabricFamily as never)) {
    return TextureRelationship.COMPETING;
  }
  if (
    strong.has(a.fabricFamily as never) !== strong.has(b.fabricFamily as never)
  ) {
    return TextureRelationship.CONTRASTING;
  }
  return TextureRelationship.SUPPORTING;
}

function proportionOf(facts: readonly FashionFormGarmentFact[]): string {
  const upper = facts.filter((f) =>
    /top|upper|blazer|blouse|shirt|jacket|outer/i.test(
      `${f.category ?? ''} ${f.type ?? ''} ${f.outfitSlot ?? ''}`,
    ),
  );
  const lower = facts.filter((f) =>
    /bottom|lower|trouser|pant|skirt|wide.?leg/i.test(
      `${f.category ?? ''} ${f.type ?? ''} ${f.outfitSlot ?? ''}`,
    ),
  );
  if (upper.length === 0 || lower.length === 0) {
    const highs = facts.filter((f) => f.visualVolume === VisualVolume.HIGH);
    if (highs.length >= 2) return ProportionRelationship.MULTI_DOMINANT;
    return ProportionRelationship.UNKNOWN;
  }
  const uHigh = upper.some((f) => f.visualVolume === VisualVolume.HIGH);
  const lHigh = lower.some((f) => f.visualVolume === VisualVolume.HIGH);
  const uUnk = upper.every((f) => f.visualVolume === VisualVolume.UNKNOWN);
  const lUnk = lower.every((f) => f.visualVolume === VisualVolume.UNKNOWN);
  if (uUnk || lUnk) return ProportionRelationship.UNKNOWN;
  if (uHigh && lHigh) return ProportionRelationship.MULTI_DOMINANT;
  if (uHigh && !lHigh) return ProportionRelationship.TOP_DOMINANT;
  if (lHigh && !uHigh) return ProportionRelationship.BOTTOM_DOMINANT;
  return ProportionRelationship.BALANCED;
}

function lengthOf(facts: readonly FashionFormGarmentFact[]): string {
  const lengths = facts.map((f) => f.length).filter(Boolean) as string[];
  if (lengths.length < 2) return LengthRelationship.UNKNOWN;
  const joined = lengths.join(' ').toLowerCase();
  if (/crop/.test(joined) && /high.?rise/.test(joined)) {
    return LengthRelationship.CROPPED_UPPER_HIGH_RISE_LOWER;
  }
  if (/outer.*long|long.*outer|maxi|midi|mini/.test(joined)) {
    if (/maxi|midi|mini/.test(joined)) return LengthRelationship.MIDI_MAXI_MINI;
  }
  if (/overlap/.test(joined)) return LengthRelationship.OVERLAPPING_LENGTHS;
  return LengthRelationship.UNKNOWN;
}

/**
 * Categorical complexity — no numeric score, no attractiveness weight.
 * Documented inputs: texture contrast, volume dominance count, pattern, accessory dominance, color contrast hint.
 */
function complexityOf(input: {
  readonly facts: readonly FashionFormGarmentFact[];
  readonly texture: string;
  readonly colorContrastHigh?: boolean;
  readonly accessoryDominanceHigh?: boolean;
}): string {
  if (
    input.facts.every(
      (f) =>
        f.silhouette === SilhouetteVocabulary.UNKNOWN &&
        f.fabricFamily === FabricSemanticFamily.UNKNOWN,
    )
  ) {
    return VisualComplexity.UNKNOWN;
  }
  let signals = 0;
  if (
    input.texture === TextureRelationship.COMPETING ||
    input.texture === TextureRelationship.CONTRASTING
  ) {
    signals += 1;
  }
  const highVol = input.facts.filter(
    (f) => f.visualVolume === VisualVolume.HIGH,
  ).length;
  if (highVol >= 2) signals += 1;
  if (input.facts.some((f) => f.pattern && f.pattern !== 'solid')) signals += 1;
  if (input.colorContrastHigh) signals += 1;
  if (input.accessoryDominanceHigh) signals += 1;
  if (signals >= 3) return VisualComplexity.HIGH;
  if (signals === 0) return VisualComplexity.LOW;
  return VisualComplexity.MEDIUM;
}

export function projectFormRelationships(input: {
  readonly garments: readonly RawFormGarmentInput[];
  readonly layeringSummary?: string;
  readonly layeringEvidenceRefs?: readonly string[];
  readonly colorContrastHigh?: boolean;
  readonly accessoryDominanceHigh?: boolean;
}): FormRelationshipProjection {
  const garmentFacts = input.garments.map(projectFormGarmentFact);
  const textureRelationship =
    garmentFacts.length >= 2
      ? textureBetween(garmentFacts[0]!, garmentFacts[1]!)
      : TextureRelationship.UNKNOWN;
  const proportionRelationship = proportionOf(garmentFacts);
  const lengthRelationship = lengthOf(garmentFacts);
  const visualComplexity = complexityOf({
    facts: garmentFacts,
    texture: textureRelationship,
    colorContrastHigh: input.colorContrastHigh,
    accessoryDominanceHigh: input.accessoryDominanceHigh,
  });

  const hasMaterial = garmentFacts.some(
    (f) => f.materialEvidence !== FabricEvidenceState.UNKNOWN,
  );
  const hasSilhouette = garmentFacts.some(
    (f) => f.silhouette !== SilhouetteVocabulary.UNKNOWN,
  );
  const hasColors = garmentFacts.some((f) => f.colors.length > 0);

  let evidenceSufficiency: string = EvidenceSufficiency.SUFFICIENT;
  if (!hasMaterial && !hasSilhouette) {
    evidenceSufficiency = hasColors
      ? EvidenceSufficiency.INSUFFICIENT_EVIDENCE
      : EvidenceSufficiency.NEED_CLARIFICATION;
  } else if (!hasMaterial || !hasSilhouette) {
    evidenceSufficiency = EvidenceSufficiency.PARTIAL;
  }

  const limitations = Object.freeze([
    ...new Set(garmentFacts.flatMap((f) => [...f.limitations])),
    ...(evidenceSufficiency === EvidenceSufficiency.INSUFFICIENT_EVIDENCE
      ? ['do_not_fabricate_fabric_silhouette_advice']
      : []),
    'oi_layering_consume_only',
    'law37_no_body_judgment',
  ]);

  return Object.freeze({
    schemaVersion: FASHION_KNOWLEDGE_FORM_FACT_VERSION,
    garmentFacts: Object.freeze(garmentFacts),
    textureRelationship,
    proportionRelationship,
    lengthRelationship,
    visualComplexity,
    evidenceSufficiency,
    layeringSummary: input.layeringSummary,
    layeringEvidenceRefs: Object.freeze([
      ...(input.layeringEvidenceRefs ?? []),
    ]),
    oiLayeringBoundary: 'CONSUME_ONLY',
    limitations,
    explainability: Object.freeze({
      inputFactIds: Object.freeze(garmentFacts.map((f) => f.garmentId)),
      relationshipNotes: Object.freeze([
        `texture=${textureRelationship}`,
        `proportion=${proportionRelationship}`,
        `length=${lengthRelationship}`,
        `complexity=${visualComplexity}`,
        `sufficiency=${evidenceSufficiency}`,
      ]),
    }),
  });
}
