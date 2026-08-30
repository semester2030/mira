/**
 * FK-8 — Engineering Law #38 (Fashion Knowledge governance only).
 * Additive. Does not renumber or modify Laws #1–#37.
 */
import { FASHION_KNOWLEDGE_ENGINEERING_LAW_38_VERSION } from '../versioning/release';

export const ENGINEERING_LAW_38 = Object.freeze({
  lawId: 38 as const,
  schemaVersion: FASHION_KNOWLEDGE_ENGINEERING_LAW_38_VERSION,
  title: 'Cultural fashion guidance boundary',
  statement:
    'Cultural fashion guidance must be explicit, contextual, source-governed, and never inferred as identity.',
  allowed: Object.freeze([
    'explicit_user_declared_cultural_context',
    'event_configured_cultural_context',
    'scoped_regional_applicability_with_provenance',
    'qualified_uncurated_mode_b_with_cultural_dependency',
    'user_preference_override_of_soft_convention',
    'multiple_culturally_sensitive_directions',
  ]),
  forbidden: Object.freeze([
    'infer_nationality_ethnicity_religion_from_appearance',
    'infer_identity_from_locale_or_gps_alone',
    'stereotype_essentialism',
    'religious_fashion_rulings',
    'fake_saudi_gulf_authority_from_llm',
    'auto_promote_llm_to_cultural_convention',
    'treat_one_culture_as_universally_correct',
  ]),
  ownership: 'Fashion Knowledge Layer only',
  doesNotModify: 'Engineering Laws #1–#37',
});

export function isLaw38CompatibleWithFrozenLaws(): boolean {
  return true;
}
