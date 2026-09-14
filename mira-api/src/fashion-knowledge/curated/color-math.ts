/**
 * FK-5 — Neutral color-wheel mathematics (server utility).
 * Establishes relationships only — NEVER good/bad/beautiful/wrong.
 * Inspired by existing Flutter hue geometry; additive Nest-side utility.
 */
import { FASHION_KNOWLEDGE_COLOR_MATH_VERSION } from '../versioning/release';

export const ColorRelationshipKind = {
  COMPLEMENTARY: 'COMPLEMENTARY',
  ANALOGOUS: 'ANALOGOUS',
  MONOCHROMATIC: 'MONOCHROMATIC',
  TRIADIC: 'TRIADIC',
  SPLIT_COMPLEMENTARY: 'SPLIT_COMPLEMENTARY',
  TETRADIC: 'TETRADIC',
  HIGH_CHROMATIC_DISTANCE: 'HIGH_CHROMATIC_DISTANCE',
  NEAR_NEUTRAL: 'NEAR_NEUTRAL',
  UNCLASSIFIED: 'UNCLASSIFIED',
} as const;

export type ColorRelationshipKind =
  (typeof ColorRelationshipKind)[keyof typeof ColorRelationshipKind];

export const ContrastCategory = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
} as const;

export type ContrastCategory =
  (typeof ContrastCategory)[keyof typeof ContrastCategory];

export interface HueSample {
  readonly hueDegrees: number; // 0..360
  readonly saturation?: number; // 0..1
  readonly value?: number; // 0..1
  readonly label?: string;
}

export interface ColorRelationshipObservation {
  readonly schemaVersion: typeof FASHION_KNOWLEDGE_COLOR_MATH_VERSION | string;
  readonly hueDistanceDegrees: number;
  readonly primaryRelationship: ColorRelationshipKind;
  readonly relationshipScores: Readonly<Record<string, number>>;
  readonly contrastCategory: ContrastCategory;
  readonly bothHighSaturation: boolean;
  readonly notes: string;
}

export function hueDistanceDegrees(a: number, b: number): number {
  const d = Math.abs(normalizeHue(a) - normalizeHue(b)) % 360;
  return d > 180 ? 360 - d : d;
}

export function normalizeHue(h: number): number {
  const x = h % 360;
  return x < 0 ? x + 360 : x;
}

function bell(diff: number, center: number, width: number): number {
  const d = Math.abs(diff - center);
  const soft = Math.min(d, 360 - d);
  const score = Math.exp(-0.5 * (soft / width) ** 2);
  return Math.max(0, Math.min(1, score));
}

/**
 * Classify geometric hue relationships.
 * Does not assert fashion taste or outfit quality.
 */
export function observeColorRelationship(
  a: HueSample,
  b: HueSample,
): ColorRelationshipObservation {
  const dist = hueDistanceDegrees(a.hueDegrees, b.hueDegrees);
  const satA = a.saturation ?? 0.5;
  const satB = b.saturation ?? 0.5;
  const valA = a.value ?? 0.5;
  const valB = b.value ?? 0.5;
  const bothHighSaturation = satA >= 0.55 && satB >= 0.55;
  const nearNeutral = satA < 0.12 || satB < 0.12;

  const scores: Record<string, number> = {
    [ColorRelationshipKind.COMPLEMENTARY]: bell(dist, 180, 25),
    [ColorRelationshipKind.ANALOGOUS]: bell(dist, 30, 20),
    [ColorRelationshipKind.SPLIT_COMPLEMENTARY]: Math.max(
      bell(dist, 150, 20),
      bell(dist, 210, 20),
    ),
    [ColorRelationshipKind.TRIADIC]: Math.max(
      bell(dist, 120, 18),
      bell(dist, 240, 18),
    ),
    [ColorRelationshipKind.TETRADIC]: Math.max(
      bell(dist, 90, 15),
      bell(dist, 270, 15),
    ),
    [ColorRelationshipKind.MONOCHROMATIC]:
      dist <= 15 ? 1 - Math.abs(satA - satB) * 0.3 : 0,
  };

  let primary: ColorRelationshipKind = ColorRelationshipKind.UNCLASSIFIED;
  let best = 0.35;
  for (const [k, v] of Object.entries(scores)) {
    if (v > best) {
      best = v;
      primary = k as ColorRelationshipKind;
    }
  }
  if (nearNeutral) {
    primary = ColorRelationshipKind.NEAR_NEUTRAL;
  } else if (primary === ColorRelationshipKind.UNCLASSIFIED && dist >= 50) {
    primary = ColorRelationshipKind.HIGH_CHROMATIC_DISTANCE;
  }

  const valueDelta = Math.abs(valA - valB);
  const satProduct = satA * satB;
  let contrastCategory: ContrastCategory = ContrastCategory.MEDIUM;
  if (dist >= 55 && bothHighSaturation) {
    contrastCategory = ContrastCategory.HIGH;
  } else if (dist <= 25 && valueDelta < 0.25 && satProduct < 0.35) {
    contrastCategory = ContrastCategory.LOW;
  } else if (valueDelta >= 0.45) {
    contrastCategory = ContrastCategory.HIGH;
  }

  return Object.freeze({
    schemaVersion: FASHION_KNOWLEDGE_COLOR_MATH_VERSION,
    hueDistanceDegrees: Math.round(dist * 1000) / 1000,
    primaryRelationship: primary,
    relationshipScores: Object.freeze(scores),
    contrastCategory,
    bothHighSaturation,
    notes:
      'Geometric observation only — not a fashion quality judgment. Do not narrate as outfit success/failure or beauty ranking.',
  });
}

/** Canonical demo hues for red / yellow (HSV-ish). Not a clash ban. */
export const DEMO_HUE_RED: HueSample = Object.freeze({
  hueDegrees: 0,
  saturation: 0.85,
  value: 0.75,
  label: 'red',
});
export const DEMO_HUE_YELLOW: HueSample = Object.freeze({
  hueDegrees: 55,
  saturation: 0.9,
  value: 0.9,
  label: 'yellow',
});
