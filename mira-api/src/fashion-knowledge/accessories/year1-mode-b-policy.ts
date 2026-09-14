/**
 * FK-6 — Year-1 Mode B governance policy (formal).
 * LLM may guide; it never becomes Mira curated truth.
 */
import {
  ProvenanceApprovalStatus,
  ProvenanceSourceType,
} from '../contracts/provenance';
import { KnowledgeType } from '../contracts/knowledge-types';
import { FASHION_KNOWLEDGE_YEAR1_MODE_B_POLICY_VERSION } from '../versioning/release';

export const YEAR1_MODE_B_POLICY = Object.freeze({
  schemaVersion: FASHION_KNOWLEDGE_YEAR1_MODE_B_POLICY_VERSION,
  purpose:
    'Allow qualified structured LLM fashion guidance in Year-1 while Mode A curated knowledge is developed gradually',
  allowedUsage: Object.freeze([
    'structured_fashion_advice_candidate_drafts',
    'shoes_bags_jewelry_accessory_reasoning',
    'color_occasion_supporting_guidance',
    'multiple_qualified_alternatives',
  ]),
  prohibitedUsage: Object.freeze([
    'auto_promote_to_active_registry',
    'waive_claim_lock',
    'claim_mira_curated_truth',
    'authoritative_pass_from_llm_alone',
    'shopping_sku_brand_price',
    'attractiveness_or_body_judgments',
  ]),
  forcedSourceType: ProvenanceSourceType.LLM_GENERAL_KNOWLEDGE,
  forcedApprovalStatus: ProvenanceApprovalStatus.UNCURATED,
  forcedKnowledgeType: KnowledgeType.LLM_GENERAL_KNOWLEDGE,
  defaultPublicEligibility: 'PASS_WITH_QUALIFICATION' as const,
  confidenceCapPolicy: 'fk2_fk3_llm_cap',
  claimLockMandatory: true,
  telemetryRequiredLater: 'FK-9',
  sourcePromotionProhibition: true,
  axioms: Object.freeze([
    'USER_ACCEPTANCE_IS_NOT_DOMAIN_TRUTH',
    'LLM_FREQUENCY_IS_NOT_DOMAIN_TRUTH',
    'POPULARITY_IS_NOT_DOMAIN_TRUTH',
  ]),
  disablePolicy:
    'Disable via FASHION_KNOWLEDGE_LLM_ENABLED / FASHION_KNOWLEDGE_ACCESSORIES_ENABLED; rollback leaves Mode A empty intact',
});

export function isYear1ModeBPromotionForbidden(): boolean {
  return YEAR1_MODE_B_POLICY.sourcePromotionProhibition === true;
}
