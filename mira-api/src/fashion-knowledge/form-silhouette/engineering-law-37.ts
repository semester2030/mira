/**
 * FK-7 — Engineering Law #37 (Fashion Knowledge governance only).
 * Additive. Does not renumber or modify Laws #1–#36.
 */
import { FASHION_KNOWLEDGE_ENGINEERING_LAW_37_VERSION } from '../versioning/release';

export const ENGINEERING_LAW_37 = Object.freeze({
  lawId: 37 as const,
  schemaVersion: FASHION_KNOWLEDGE_ENGINEERING_LAW_37_VERSION,
  title: 'Garment-proportion reasoning boundary',
  statement:
    'Fashion proportion reasoning evaluates relationships between garments, not the attractiveness, correctness, or worth of the wearer\'s body.',
  allowed: Object.freeze([
    'garment_to_garment_proportion',
    'visual_volume_between_pieces',
    'silhouette_relationship',
    'layering_knowledge_interpretation',
    'length_relationship',
    'outfit_balance_descriptive',
  ]),
  forbidden: Object.freeze([
    'body_attractiveness_score',
    'ideal_body_logic',
    'slimming_fattening_judgment',
    'hiding_body_parts',
    'correcting_user_body',
    'body_shape_hierarchy',
    'attractiveness_optimization',
  ]),
  ownership: 'Fashion Knowledge Layer only',
  doesNotModify: 'Engineering Laws #1–#36 frozen implementations',
});

export function isLaw37CompatibleWithFrozenLaws(): boolean {
  // Additive FK governance — does not weaken #1–#36
  return true;
}
