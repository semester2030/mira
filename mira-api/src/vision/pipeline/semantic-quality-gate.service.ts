import {
  FashionVisionValidationError,
  FashionVisionValidationResult,
  SemanticsPayload,
  SemanticGarment,
} from '../schema/fashion-vision-document.v1';

/** Fields that must never appear in OpenAI semantic output (Phase 4). */
export const OPENAI_FORBIDDEN_SEMANTIC_KEYS = [
  'compatibilityScore',
  'compatibility_score',
  'recommendation',
  'recommendations',
  'luxuryRating',
  'luxury_rating',
  'outfitGrade',
  'styleVerdict',
  'style_verdict',
  'skinCompatibilityScore',
  'occasionMatchScore',
  'colorHarmonyScore',
  'styleBalanceScore',
  'suggestedMakeup',
  'avoidColors',
  'suggestedColors',
  'explanation',
  'userId',
  'occasionId',
] as const;

function err(path: string, code: string, message: string): FashionVisionValidationError {
  return { path, code, message };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

function isFinite01(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;
}

/** Reject score/recommendation fields in raw provider JSON before parsing. */
export function assertNoForbiddenOpenAiFields(
  payload: unknown,
  path = '$',
): FashionVisionValidationError[] {
  const errors: FashionVisionValidationError[] = [];
  if (!isRecord(payload) && !Array.isArray(payload)) return errors;

  if (isRecord(payload)) {
    for (const key of Object.keys(payload)) {
      if ((OPENAI_FORBIDDEN_SEMANTIC_KEYS as readonly string[]).includes(key)) {
        errors.push(
          err(path, 'FORBIDDEN_FIELD', `OpenAI semantics must not include ${key}`),
        );
      }
      const child = payload[key];
      if (isRecord(child) || Array.isArray(child)) {
        errors.push(...assertNoForbiddenOpenAiFields(child, `${path}.${key}`));
      }
    }
  }

  if (Array.isArray(payload)) {
    payload.forEach((item, i) => {
      errors.push(...assertNoForbiddenOpenAiFields(item, `${path}[${i}]`));
    });
  }

  return errors;
}

export function validateSemanticsPayload(payload: SemanticsPayload): FashionVisionValidationResult {
  const errors: FashionVisionValidationError[] = [];

  if (!Array.isArray(payload.garments) || payload.garments.length === 0) {
    errors.push(err('semantics.garments', 'REQUIRED', 'at least one garment required'));
  } else {
    payload.garments.forEach((g, i) => validateGarment(g, `semantics.garments[${i}]`, errors));
  }

  if (!Array.isArray(payload.layering)) {
    errors.push(err('semantics.layering', 'REQUIRED', 'layering must be array'));
  }

  if (!Array.isArray(payload.dominantColorIds) || payload.dominantColorIds.length === 0) {
    errors.push(err('semantics.dominantColorIds', 'REQUIRED', 'dominantColorIds required'));
  }

  if (!Array.isArray(payload.secondaryColorIds)) {
    errors.push(err('semantics.secondaryColorIds', 'REQUIRED', 'secondaryColorIds required'));
  }

  if (Array.isArray(payload.accessories)) {
    payload.accessories.forEach((a, i) => {
      const base = `semantics.accessories[${i}]`;
      if (!a.categoryId?.trim()) {
        errors.push(err(`${base}.categoryId`, 'REQUIRED', 'categoryId required'));
      }
      if (!a.typeId?.trim()) {
        errors.push(err(`${base}.typeId`, 'REQUIRED', 'typeId required'));
      }
      if (!isFinite01(a.providerConfidence)) {
        errors.push(err(`${base}.providerConfidence`, 'RANGE', 'confidence 0..1'));
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

function validateGarment(
  g: SemanticGarment,
  path: string,
  errors: FashionVisionValidationError[],
): void {
  if (!g.categoryId?.trim()) {
    errors.push(err(`${path}.categoryId`, 'REQUIRED', 'categoryId required'));
  }
  if (!g.typeId?.trim()) {
    errors.push(err(`${path}.typeId`, 'REQUIRED', 'typeId required'));
  }
  if (!Array.isArray(g.colors) || g.colors.length === 0) {
    errors.push(err(`${path}.colors`, 'REQUIRED', 'colors required'));
  }
  if (!isFinite01(g.providerConfidence)) {
    errors.push(err(`${path}.providerConfidence`, 'RANGE', 'confidence 0..1'));
  }
}

export function runSemanticQualityGate(
  rawPayload: unknown,
  semantics: SemanticsPayload,
): FashionVisionValidationResult {
  const forbidden = assertNoForbiddenOpenAiFields(rawPayload);
  if (forbidden.length > 0) {
    return { valid: false, errors: forbidden };
  }
  return validateSemanticsPayload(semantics);
}
