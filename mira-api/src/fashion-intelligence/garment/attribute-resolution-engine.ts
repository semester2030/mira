import {
  FashionOntologyRegistry,
  isKnownColorId,
  loadFashionOntologyRegistry,
} from '../../vision/schema/fashion-ontology.registry';
import {
  normalizeColorId,
  normalizeFitId,
  normalizeMaterialId,
} from './normalization-engine';
import { CanonicalGarmentMaterial } from './canonical-garment';

export interface AttributeResolutionInput {
  colors?: string[];
  material?: string;
  materialConfidence?: number;
  fit?: string;
  pattern?: string;
  sleeve?: string;
  neckline?: string;
  styleHints?: string[];
  /** Only when evidenced (e.g. catalog match) — never invent */
  season?: string[];
  occasion?: string[];
}

export interface AttributeResolutionResult {
  colors: string[];
  pattern?: string;
  material: CanonicalGarmentMaterial;
  fit?: string;
  sleeve?: string;
  neckline?: string;
  styleHints: string[];
  season: string[];
  occasion: string[];
  limitationCodes: string[];
  fieldConfidence: Array<{ field: string; confidence: number }>;
}

/**
 * Attribute Resolution — evidence only. Never fabricate.
 */
export class AttributeResolutionEngine {
  constructor(
    private readonly ontology: FashionOntologyRegistry = loadFashionOntologyRegistry(),
  ) {}

  resolve(input: AttributeResolutionInput): AttributeResolutionResult {
    const limitationCodes: string[] = [];
    const fieldConfidence: Array<{ field: string; confidence: number }> = [];

    const colors: string[] = [];
    for (const c of input.colors ?? []) {
      const id = normalizeColorId(c);
      if (!id) continue;
      if (isKnownColorId(this.ontology, id)) {
        colors.push(id);
        fieldConfidence.push({ field: `color:${id}`, confidence: 0.85 });
      } else {
        limitationCodes.push(`color_unmapped:${c}`);
      }
    }
    if (colors.length === 0) {
      limitationCodes.push('color_missing');
    }

    let material: CanonicalGarmentMaterial = { kind: 'unknown' };
    if (input.material && String(input.material).trim()) {
      const mid = normalizeMaterialId(input.material);
      if (mid) {
        material = {
          value: mid,
          kind: 'estimated',
          confidence: input.materialConfidence ?? 0.55,
        };
        fieldConfidence.push({
          field: 'material',
          confidence: material.confidence ?? 0.55,
        });
        limitationCodes.push('material_estimated');
      }
    } else {
      limitationCodes.push('material_missing');
    }

    let fit: string | undefined;
    if (input.fit && String(input.fit).trim()) {
      fit = normalizeFitId(input.fit) || undefined;
      if (fit) {
        fieldConfidence.push({ field: 'fit', confidence: 0.6 });
      }
    } else {
      limitationCodes.push('fit_missing');
    }

    let pattern: string | undefined;
    if (input.pattern && String(input.pattern).trim()) {
      pattern = String(input.pattern).trim().toLowerCase();
      fieldConfidence.push({ field: 'pattern', confidence: 0.5 });
    } else {
      limitationCodes.push('pattern_missing');
    }

    const sleeve = input.sleeve?.trim() || undefined;
    const neckline = input.neckline?.trim() || undefined;
    if (!sleeve) limitationCodes.push('sleeve_missing');
    if (!neckline) limitationCodes.push('neckline_missing');

    const styleHints = (input.styleHints ?? [])
      .map((s) => s.trim())
      .filter(Boolean);
    if (styleHints.length === 0) {
      limitationCodes.push('style_hints_missing');
    }

    // Season / occasion only if explicitly evidenced in input
    const season = (input.season ?? []).map((s) => s.trim()).filter(Boolean);
    const occasion = (input.occasion ?? []).map((s) => s.trim()).filter(Boolean);
    if (season.length === 0) limitationCodes.push('season_not_evidenced');
    if (occasion.length === 0) limitationCodes.push('occasion_not_evidenced');

    return {
      colors,
      pattern,
      material,
      fit,
      sleeve,
      neckline,
      styleHints,
      season,
      occasion,
      limitationCodes,
      fieldConfidence,
    };
  }
}
