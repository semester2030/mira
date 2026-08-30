/**
 * FK-5 — Dress code model (distinct from occasion).
 */
import { FASHION_KNOWLEDGE_DRESS_CODE_MODEL_VERSION } from '../versioning/release';

export const FashionDressCodeId = {
  BLACK_TIE: 'black_tie',
  FORMAL: 'formal',
  SEMI_FORMAL: 'semi_formal',
  COCKTAIL: 'cocktail',
  BUSINESS_FORMAL: 'business_formal',
  BUSINESS_CASUAL: 'business_casual',
  SMART_CASUAL: 'smart_casual',
  CASUAL: 'casual',
  DAYTIME_FORMAL: 'daytime_formal',
  CREATIVE_BLACK_TIE: 'creative_black_tie',
  UNKNOWN: 'unknown',
} as const;

export type FashionDressCodeId =
  (typeof FashionDressCodeId)[keyof typeof FashionDressCodeId];

export const ALL_FASHION_DRESS_CODE_IDS: readonly FashionDressCodeId[] =
  Object.freeze(Object.values(FashionDressCodeId));

export interface FashionDressCodeDefinition {
  readonly dressCodeId: FashionDressCodeId;
  readonly label: string;
  readonly formalityRank: number; // 0..10 approximate
  readonly notes: string;
}

export const FASHION_DRESS_CODE_CATALOG: readonly FashionDressCodeDefinition[] =
  Object.freeze([
    {
      dressCodeId: FashionDressCodeId.BLACK_TIE,
      label: 'Black tie',
      formalityRank: 9,
      notes: 'Dress code — not an occasion. May apply at weddings or other events.',
    },
    {
      dressCodeId: FashionDressCodeId.FORMAL,
      label: 'Formal',
      formalityRank: 8,
      notes: 'Generic formal dress code.',
    },
    {
      dressCodeId: FashionDressCodeId.SEMI_FORMAL,
      label: 'Semi-formal',
      formalityRank: 6,
      notes: 'Semi-formal dress code.',
    },
    {
      dressCodeId: FashionDressCodeId.COCKTAIL,
      label: 'Cocktail',
      formalityRank: 6,
      notes: 'Cocktail dress code (distinct from cocktail occasion).',
    },
    {
      dressCodeId: FashionDressCodeId.BUSINESS_FORMAL,
      label: 'Business formal',
      formalityRank: 7,
      notes: 'Business formal dress code.',
    },
    {
      dressCodeId: FashionDressCodeId.BUSINESS_CASUAL,
      label: 'Business casual',
      formalityRank: 4,
      notes: 'Business casual dress code.',
    },
    {
      dressCodeId: FashionDressCodeId.SMART_CASUAL,
      label: 'Smart casual',
      formalityRank: 3,
      notes: 'Smart casual dress code.',
    },
    {
      dressCodeId: FashionDressCodeId.CASUAL,
      label: 'Casual',
      formalityRank: 2,
      notes: 'Casual dress code.',
    },
    {
      dressCodeId: FashionDressCodeId.DAYTIME_FORMAL,
      label: 'Daytime formal',
      formalityRank: 7,
      notes: 'Daytime formal expectation (dress code).',
    },
    {
      dressCodeId: FashionDressCodeId.CREATIVE_BLACK_TIE,
      label: 'Creative black tie',
      formalityRank: 8,
      notes: 'Explicitly invites creative/statement styling within formal frame.',
    },
    {
      dressCodeId: FashionDressCodeId.UNKNOWN,
      label: 'Unknown',
      formalityRank: 0,
      notes: 'Dress code not provided — clarification may be required.',
    },
  ]);

export const DRESS_CODE_MODEL_VERSION =
  FASHION_KNOWLEDGE_DRESS_CODE_MODEL_VERSION;

export function isFashionDressCodeId(v: unknown): v is FashionDressCodeId {
  return (
    typeof v === 'string' &&
    (ALL_FASHION_DRESS_CODE_IDS as readonly string[]).includes(v)
  );
}

/** Wedding (occasion) ≠ black_tie (dress code). */
export function conceptsAreDistinct(
  occasionId: string,
  dressCodeId: string,
): boolean {
  return occasionId !== dressCodeId;
}
