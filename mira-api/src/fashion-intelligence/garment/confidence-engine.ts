import { GarmentFieldConfidence } from './canonical-garment';

/**
 * Confidence Engine — evidence-based aggregation (6C.1: fusion.fieldConfidence).
 */
export class ConfidenceEngine {
  aggregate(input: {
    fusionOverall?: number;
    providerConfidence?: number;
    fieldConfidence: GarmentFieldConfidence[];
    /** Vision fusion per-field confidence (evidence-linked). */
    fusionFieldConfidence?: GarmentFieldConfidence[];
    classificationKnown: boolean;
    mappingComplete: boolean;
  }): { overall: number; fields: GarmentFieldConfidence[] } {
    const attrFields = [...input.fieldConfidence];
    const fusionFields = [...(input.fusionFieldConfidence ?? [])];

    // Prefer fusion evidence when field names overlap; otherwise keep both.
    const byName = new Map<string, number>();
    for (const f of attrFields) {
      byName.set(normalizeFieldKey(f.field), clamp01(f.confidence));
    }
    for (const f of fusionFields) {
      byName.set(normalizeFieldKey(f.field), clamp01(f.confidence));
    }
    const fields: GarmentFieldConfidence[] = [
      ...fusionFields.map((f) => ({
        field: f.field,
        confidence: clamp01(f.confidence),
      })),
      ...attrFields.filter(
        (f) =>
          !fusionFields.some(
            (ff) => normalizeFieldKey(ff.field) === normalizeFieldKey(f.field),
          ),
      ),
    ];

    const parts: number[] = [];

    if (typeof input.fusionOverall === 'number' && !Number.isNaN(input.fusionOverall)) {
      parts.push(clamp01(input.fusionOverall));
    }
    if (
      typeof input.providerConfidence === 'number' &&
      !Number.isNaN(input.providerConfidence)
    ) {
      parts.push(clamp01(input.providerConfidence));
    }
    if (byName.size > 0) {
      const vals = [...byName.values()];
      parts.push(vals.reduce((s, v) => s + v, 0) / vals.length);
    }
    if (!input.classificationKnown) {
      parts.push(0.35);
    }
    if (!input.mappingComplete) {
      parts.push(0.4);
    }

    const overall =
      parts.length === 0
        ? 0
        : clamp01(parts.reduce((a, b) => a + b, 0) / parts.length);

    return { overall, fields };
  }

  validate(overall: number): boolean {
    return typeof overall === 'number' && !Number.isNaN(overall) && overall >= 0 && overall <= 1;
  }
}

function normalizeFieldKey(field: string): string {
  return field.trim().toLowerCase().replace(/^semantics\.garments\[\d+]\./, '');
}

function clamp01(n: number): number {
  if (n > 1 && n <= 100) return n / 100;
  return Math.max(0, Math.min(1, n));
}
