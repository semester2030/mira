/**
 * FK-2 — Contract validators (rules, candidates, leakage).
 */
import type { FashionAdviceCandidate } from '../advice/advice-candidate';
import { CandidateSourceType } from '../advice/advice-candidate';
import {
  FORBIDDEN_CONDITION_TOKENS,
  isConditionField,
  isConditionOperator,
} from '../contracts/conditions';
import { isFashionAdviceType } from '../contracts/advice-types';
import { isKnowledgeConfidence, KnowledgeConfidence } from '../contracts/confidence';
import { isConflictState } from '../contracts/conflicts';
import { isKnowledgeType, KnowledgeType } from '../contracts/knowledge-types';
import {
  isProvenanceApprovalStatus,
  isProvenanceSourceType,
  ProvenanceApprovalStatus,
  ProvenanceSourceType,
} from '../contracts/provenance';
import { isFashionRuleDomain } from '../contracts/rule-domains';
import { isSubjectivityLevel } from '../contracts/subjectivity';
import type { FashionKnowledgeRule } from '../knowledge/fashion-knowledge-rule';
import { RuleLifecycleStatus } from '../knowledge/fashion-knowledge-rule';
import { validateToneSafety } from './tone-safety';
import {
  FASHION_ADVICE_CANDIDATE_VERSION,
  FASHION_KNOWLEDGE_RULE_SCHEMA_VERSION,
} from '../versioning/release';

export interface FashionKnowledgeValidationIssue {
  readonly code: string;
  readonly message: string;
}

export interface FashionKnowledgeValidationResult {
  readonly ok: boolean;
  readonly issues: FashionKnowledgeValidationIssue[];
}

function issue(
  code: string,
  message: string,
): FashionKnowledgeValidationIssue {
  return { code, message };
}

export function validateFashionKnowledgeRule(
  rule: FashionKnowledgeRule,
): FashionKnowledgeValidationResult {
  const issues: FashionKnowledgeValidationIssue[] = [];

  if (!rule.ruleId) {
    issues.push(issue('missing_rule_id', 'ruleId required'));
  }
  if (rule.schemaVersion !== FASHION_KNOWLEDGE_RULE_SCHEMA_VERSION) {
    issues.push(
      issue(
        'invalid_version',
        `Expected schema ${FASHION_KNOWLEDGE_RULE_SCHEMA_VERSION}`,
      ),
    );
  }
  if (!rule.ruleVersion) {
    issues.push(issue('invalid_version', 'ruleVersion required'));
  }
  if (!isKnowledgeType(rule.knowledgeType)) {
    issues.push(issue('missing_knowledge_type', 'knowledgeType invalid'));
  }
  if (!isFashionRuleDomain(rule.domain)) {
    issues.push(issue('invalid_domain', 'domain invalid'));
  }
  if (!rule.provenance) {
    issues.push(issue('missing_provenance', 'provenance required'));
  } else {
    if (!isProvenanceSourceType(rule.provenance.sourceType)) {
      issues.push(issue('invalid_provenance', 'sourceType invalid'));
    }
    if (!isProvenanceApprovalStatus(rule.provenance.approvalStatus)) {
      issues.push(issue('invalid_approval_state', 'approvalStatus invalid'));
    }
  }
  if (!isSubjectivityLevel(rule.subjectivity)) {
    issues.push(issue('missing_subjectivity', 'subjectivity required'));
  }
  if (!isKnowledgeConfidence(rule.confidence)) {
    issues.push(issue('invalid_confidence', 'confidence confidence invalid'));
  }

  if (
    rule.knowledgeType === KnowledgeType.LLM_GENERAL_KNOWLEDGE &&
    (rule.provenance?.approvalStatus === ProvenanceApprovalStatus.APPROVED ||
      rule.provenance?.approvalStatus === ProvenanceApprovalStatus.ACTIVE ||
      rule.status === RuleLifecycleStatus.ACTIVE)
  ) {
    issues.push(
      issue('llm_marked_curated', 'LLM knowledge cannot be curated ACTIVE'),
    );
  }

  if (
    rule.knowledgeType === KnowledgeType.LLM_GENERAL_KNOWLEDGE &&
    rule.confidence === KnowledgeConfidence.HIGH
  ) {
    issues.push(
      issue(
        'uncurated_high_confidence',
        'LLM_GENERAL_KNOWLEDGE cannot have HIGH curated confidence',
      ),
    );
  }

  if (
    rule.knowledgeType === KnowledgeType.TREND &&
    !rule.trendValidity
  ) {
    issues.push(
      issue('invalid_trend_validity', 'TREND requires trendValidity metadata'),
    );
  }

  if (
    rule.knowledgeType === KnowledgeType.CULTURAL_CONVENTION &&
    rule.culturalContext.length === 0
  ) {
    issues.push(
      issue(
        'invalid_cultural_metadata',
        'CULTURAL_CONVENTION requires culturalContext',
      ),
    );
  }

  for (const cond of rule.conditions) {
    if (!isConditionField(cond.field)) {
      issues.push(issue('invalid_condition', `Unknown field ${cond.field}`));
    }
    if (!isConditionOperator(cond.operator)) {
      issues.push(
        issue('invalid_condition', `Unknown operator ${cond.operator}`),
      );
    }
    const blob = JSON.stringify(cond).toLowerCase();
    for (const tok of FORBIDDEN_CONDITION_TOKENS) {
      if (blob.includes(tok.toLowerCase())) {
        issues.push(
          issue('provider_leakage', `Condition leaks provider token ${tok}`),
        );
      }
    }
  }

  const tone = validateToneSafety(
    `${rule.rationale} ${rule.recommendationPattern.structuredSuggestion}`,
  );
  for (const t of tone) {
    issues.push(issue('prohibited_judgment', t.message));
  }

  return { ok: issues.length === 0, issues };
}

export function validateFashionAdviceCandidate(
  candidate: FashionAdviceCandidate,
): FashionKnowledgeValidationResult {
  const issues: FashionKnowledgeValidationIssue[] = [];

  if (!candidate.candidateId) {
    issues.push(issue('missing_candidate_id', 'candidateId required'));
  }
  if (candidate.schemaVersion !== FASHION_ADVICE_CANDIDATE_VERSION) {
    issues.push(
      issue(
        'invalid_version',
        `Expected ${FASHION_ADVICE_CANDIDATE_VERSION}`,
      ),
    );
  }
  if (!isFashionAdviceType(candidate.adviceType)) {
    issues.push(issue('invalid_advice_type', 'adviceType invalid'));
  }
  if (!isKnowledgeType(candidate.knowledgeType)) {
    issues.push(issue('missing_knowledge_type', 'knowledgeType invalid'));
  }
  if (!isSubjectivityLevel(candidate.subjectivity)) {
    issues.push(issue('missing_subjectivity', 'subjectivity required'));
  }
  if (!candidate.provenance) {
    issues.push(issue('missing_provenance', 'provenance required'));
  }
  if (!isConflictState(candidate.preferenceConflict)) {
    issues.push(issue('invalid_preference_conflict', 'invalid state'));
  }
  if (!isConflictState(candidate.culturalConflict)) {
    issues.push(issue('invalid_cultural_conflict', 'invalid state'));
  }
  if (candidate.evidenceRefs.length === 0) {
    issues.push(issue('missing_evidence', 'evidenceRefs required'));
  }

  if (
    candidate.sourceType === CandidateSourceType.LLM_GENERAL_KNOWLEDGE &&
    candidate.provenanceState !== ProvenanceApprovalStatus.UNCURATED
  ) {
    issues.push(
      issue('llm_marked_curated', 'LLM candidate must be UNCURATED'),
    );
  }

  if (
    candidate.sourceType === CandidateSourceType.LLM_GENERAL_KNOWLEDGE &&
    candidate.confidence === KnowledgeConfidence.HIGH
  ) {
    issues.push(
      issue(
        'uncurated_high_confidence',
        'LLM candidate cannot have HIGH knowledge confidence',
      ),
    );
  }

  if (
    candidate.suggestion.absoluteClaim &&
    candidate.subjectivity !== 'LOW_SUBJECTIVITY'
  ) {
    issues.push(
      issue(
        'absolute_claim_from_subjective',
        'Absolute claim forbidden for subjective sources',
      ),
    );
  }

  if (
    candidate.provenance?.sourceType === ProvenanceSourceType.UNKNOWN &&
    (candidate.provenanceState === ProvenanceApprovalStatus.APPROVED ||
      candidate.provenanceState === ProvenanceApprovalStatus.ACTIVE)
  ) {
    issues.push(
      issue('fake_provenance', 'Unknown source cannot be APPROVED/ACTIVE'),
    );
  }

  for (const alt of candidate.alternatives) {
    if (!alt.alternativeId || !alt.direction) {
      issues.push(issue('invalid_alternative', 'alternative incomplete'));
    }
  }

  const tone = validateToneSafety(
    [
      candidate.currentObservation,
      candidate.suggestion.structuredText,
      candidate.rationale,
      ...candidate.limitations,
    ].join(' '),
  );
  for (const t of tone) {
    if (t.code === 'ATTRACTIVENESS' || t.code === 'BODY_SHAMING') {
      issues.push(issue('attractiveness_body_claim', t.message));
    } else if (t.code === 'PROVIDER_LEAKAGE') {
      issues.push(issue('provider_leakage', t.message));
    } else {
      issues.push(issue('prohibited_judgment', t.message));
    }
  }

  const leakBlob = JSON.stringify(candidate).toLowerCase();
  for (const tok of ['fashn', 'openai', 'provider_id', 'raw_provider']) {
    if (leakBlob.includes(tok)) {
      issues.push(
        issue('provider_leakage', `Candidate leaks token ${tok}`),
      );
    }
  }

  return { ok: issues.length === 0, issues };
}

export function assertNoProductionRules(
  rules: readonly FashionKnowledgeRule[],
): FashionKnowledgeValidationResult {
  const prod = rules.filter((r) => r.testOnly !== true);
  if (prod.length > 0) {
    return {
      ok: false,
      issues: [
        issue(
          'production_rule_population',
          `FK-2 forbids production rules; found ${prod.map((r) => r.ruleId).join(',')}`,
        ),
      ],
    };
  }
  return { ok: true, issues: [] };
}
