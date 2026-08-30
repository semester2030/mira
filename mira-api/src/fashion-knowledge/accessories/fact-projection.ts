/**
 * FK-6 — Safe accessory fact projection (Fashion Knowledge interpretation).
 * Missing facts remain missing. No luxury/gold/leather inference.
 */
import { FASHION_KNOWLEDGE_ACCESSORY_FACT_VERSION } from '../versioning/release';
import {
  AccessoryPresence,
  AccessoryRole,
  MetallicFamily,
  VisualDominance,
  type AccessoryCategory,
} from './models';

export interface RawAccessoryFactInput {
  readonly accessoryId: string;
  readonly category: AccessoryCategory | string;
  readonly type?: string;
  readonly primaryColor?: string;
  readonly secondaryColors?: readonly string[];
  readonly material?: string;
  readonly pattern?: string;
  readonly formalityHint?: string;
  readonly metallicFamily?: string;
  readonly outfitRole?: string;
  readonly presence: 'PRESENT' | 'ABSENT' | 'UNKNOWN';
  readonly confidence?: string;
  readonly evidenceRefs?: readonly string[];
  readonly visualDominanceHint?: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
}

export interface FashionAccessoryFact {
  readonly schemaVersion: typeof FASHION_KNOWLEDGE_ACCESSORY_FACT_VERSION | string;
  readonly accessoryId: string;
  readonly category: string;
  readonly type?: string;
  readonly primaryColor?: string;
  readonly secondaryColors: readonly string[];
  readonly material?: string;
  readonly pattern?: string;
  readonly formalityHint?: string;
  readonly metallicFamily: string;
  readonly outfitRole: string;
  readonly presence: 'PRESENT' | 'ABSENT' | 'UNKNOWN';
  readonly visualDominance: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  readonly confidence?: string;
  readonly evidenceRefs: readonly string[];
}

const METALLIC_OK = new Set(Object.values(MetallicFamily));
const ROLE_OK = new Set(Object.values(AccessoryRole));
const DOM_OK = new Set(Object.values(VisualDominance));

export function projectAccessoryFact(
  input: RawAccessoryFactInput,
): FashionAccessoryFact {
  const metallic =
    input.metallicFamily && METALLIC_OK.has(input.metallicFamily as never)
      ? input.metallicFamily
      : MetallicFamily.UNKNOWN;
  const role =
    input.outfitRole && ROLE_OK.has(input.outfitRole as never)
      ? input.outfitRole
      : AccessoryRole.UNKNOWN;
  const dominance =
    input.visualDominanceHint && DOM_OK.has(input.visualDominanceHint as never)
      ? input.visualDominanceHint
      : VisualDominance.UNKNOWN;

  // Do not invent metallic from color words like "gold" without explicit field
  return Object.freeze({
    schemaVersion: FASHION_KNOWLEDGE_ACCESSORY_FACT_VERSION,
    accessoryId: input.accessoryId,
    category: input.category,
    type: input.type,
    primaryColor: input.primaryColor,
    secondaryColors: Object.freeze([...(input.secondaryColors ?? [])]),
    material: input.material,
    pattern: input.pattern,
    formalityHint: input.formalityHint,
    metallicFamily: metallic,
    outfitRole: role,
    presence: input.presence,
    visualDominance: dominance,
    confidence: input.confidence,
    evidenceRefs: Object.freeze([...(input.evidenceRefs ?? [])]),
  });
}

export function unknownAccessorySlot(
  category: string,
  accessoryId: string,
): FashionAccessoryFact {
  return projectAccessoryFact({
    accessoryId,
    category,
    presence: AccessoryPresence.UNKNOWN,
  });
}
