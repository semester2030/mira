/**
 * FK-5 — Occasion model (not dress code).
 * No Saudi/Gulf cultural population.
 */
import { FASHION_KNOWLEDGE_OCCASION_MODEL_VERSION } from '../versioning/release';

export const FashionOccasionId = {
  WEDDING: 'wedding',
  DAYTIME_WEDDING: 'daytime_wedding',
  EVENING_WEDDING: 'evening_wedding',
  FORMAL_EVENING: 'formal_evening',
  COCKTAIL: 'cocktail',
  BUSINESS: 'business',
  SMART_CASUAL: 'smart_casual',
  CASUAL: 'casual',
  BLACK_TIE_EVENT: 'black_tie_event',
} as const;

export type FashionOccasionId =
  (typeof FashionOccasionId)[keyof typeof FashionOccasionId];

export const ALL_FASHION_OCCASION_IDS: readonly FashionOccasionId[] =
  Object.freeze(Object.values(FashionOccasionId));

export interface FashionOccasionDefinition {
  readonly occasionId: FashionOccasionId;
  readonly label: string;
  readonly dayEveningHint?: 'day' | 'evening' | 'either';
  readonly notes: string;
  /** Occasions may admit multiple dress codes — never collapse concepts. */
  readonly typicalDressCodeHints: readonly string[];
}

export const FASHION_OCCASION_CATALOG: readonly FashionOccasionDefinition[] =
  Object.freeze([
    {
      occasionId: FashionOccasionId.WEDDING,
      label: 'Wedding (generic)',
      dayEveningHint: 'either',
      notes:
        'Generic wedding occasion — not culturally localized. Dress code often unknown.',
      typicalDressCodeHints: ['cocktail', 'semi_formal', 'formal', 'black_tie'],
    },
    {
      occasionId: FashionOccasionId.DAYTIME_WEDDING,
      label: 'Daytime wedding',
      dayEveningHint: 'day',
      notes: 'Day context may differ from evening wedding; still not cultural law.',
      typicalDressCodeHints: ['daytime_formal', 'cocktail', 'semi_formal'],
    },
    {
      occasionId: FashionOccasionId.EVENING_WEDDING,
      label: 'Evening wedding',
      dayEveningHint: 'evening',
      notes: 'Evening wedding context; dress code still may vary.',
      typicalDressCodeHints: ['cocktail', 'formal', 'black_tie'],
    },
    {
      occasionId: FashionOccasionId.FORMAL_EVENING,
      label: 'Formal evening',
      dayEveningHint: 'evening',
      notes: 'Occasion bucket — pair with explicit dress code when known.',
      typicalDressCodeHints: ['formal', 'black_tie'],
    },
    {
      occasionId: FashionOccasionId.COCKTAIL,
      label: 'Cocktail event',
      dayEveningHint: 'either',
      notes: 'Occasion may overlap naming with cocktail dress code — keep distinct.',
      typicalDressCodeHints: ['cocktail'],
    },
    {
      occasionId: FashionOccasionId.BUSINESS,
      label: 'Business',
      dayEveningHint: 'day',
      notes: 'Business occasion; business_formal is a dress code.',
      typicalDressCodeHints: ['business_formal', 'business_casual'],
    },
    {
      occasionId: FashionOccasionId.SMART_CASUAL,
      label: 'Smart casual gathering',
      dayEveningHint: 'either',
      notes: 'Occasion label; smart_casual dress code is separate.',
      typicalDressCodeHints: ['smart_casual'],
    },
    {
      occasionId: FashionOccasionId.CASUAL,
      label: 'Casual',
      dayEveningHint: 'either',
      notes: 'Casual occasion.',
      typicalDressCodeHints: ['casual'],
    },
    {
      occasionId: FashionOccasionId.BLACK_TIE_EVENT,
      label: 'Black-tie event',
      dayEveningHint: 'evening',
      notes:
        'Event occasion that typically implies black_tie dress code — still two concepts.',
      typicalDressCodeHints: ['black_tie'],
    },
  ]);

export const OCCASION_MODEL_VERSION = FASHION_KNOWLEDGE_OCCASION_MODEL_VERSION;

export function isFashionOccasionId(v: unknown): v is FashionOccasionId {
  return (
    typeof v === 'string' &&
    (ALL_FASHION_OCCASION_IDS as readonly string[]).includes(v)
  );
}
