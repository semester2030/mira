/**
 * FK-3 — Knowledge type downgrade for LLM drafts.
 * LLM may not independently establish ESTABLISHED_PRINCIPLE / DRESS_CODE_RULE /
 * CULTURAL_CONVENTION as Mira-approved knowledge.
 */
import { KnowledgeType } from '../contracts/knowledge-types';

const ALLOWED_LLM_TYPES = new Set<KnowledgeType>([
  KnowledgeType.CONVENTION,
  KnowledgeType.PROFESSIONAL_OPINION,
  KnowledgeType.TREND,
  KnowledgeType.LLM_GENERAL_KNOWLEDGE,
]);

const FORBIDDEN_AUTHORITATIVE = new Set<KnowledgeType>([
  KnowledgeType.ESTABLISHED_PRINCIPLE,
  KnowledgeType.DRESS_CODE_RULE,
  KnowledgeType.CULTURAL_CONVENTION,
]);

export function resolveLlmKnowledgeType(
  proposed: KnowledgeType | undefined,
  hasApprovedSupportingRule: boolean,
): { type: KnowledgeType; downgraded: boolean; blocked: boolean } {
  if (!proposed) {
    return {
      type: KnowledgeType.LLM_GENERAL_KNOWLEDGE,
      downgraded: false,
      blocked: false,
    };
  }
  if (FORBIDDEN_AUTHORITATIVE.has(proposed) && !hasApprovedSupportingRule) {
    return {
      type: KnowledgeType.LLM_GENERAL_KNOWLEDGE,
      downgraded: true,
      blocked: false,
    };
  }
  if (!ALLOWED_LLM_TYPES.has(proposed) && proposed !== KnowledgeType.USER_PREFERENCE) {
    return {
      type: KnowledgeType.LLM_GENERAL_KNOWLEDGE,
      downgraded: true,
      blocked: false,
    };
  }
  if (proposed === KnowledgeType.USER_PREFERENCE) {
    // Preference is context, not LLM fashion truth — treat as LLM general for source
    return {
      type: KnowledgeType.LLM_GENERAL_KNOWLEDGE,
      downgraded: true,
      blocked: false,
    };
  }
  return { type: proposed, downgraded: false, blocked: false };
}
