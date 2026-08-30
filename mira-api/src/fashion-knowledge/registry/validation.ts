/**
 * FK-4 — Full registry validation (fail closed).
 */
import {
  isConditionField,
  isConditionOperator,
  FORBIDDEN_CONDITION_TOKENS,
} from '../contracts/conditions';
import { isFashionRuleDomain } from '../contracts/rule-domains';
import { isKnowledgeType, KnowledgeType } from '../contracts/knowledge-types';
import { isKnowledgeConfidence } from '../contracts/confidence';
import { isSubjectivityLevel } from '../contracts/subjectivity';
import {
  isProvenanceApprovalStatus,
  isProvenanceSourceType,
  ProvenanceApprovalStatus,
  ProvenanceSourceType,
} from '../contracts/provenance';
import { RuleLifecycleStatus } from '../knowledge/fashion-knowledge-rule';
import type { FashionKnowledgeRule } from '../knowledge/fashion-knowledge-rule';
import type { FashionRuleRelation } from '../contracts/conflicts';
import { RuleRelationType } from '../contracts/conflicts';
import type { FashionKnowledgeRegistry } from './contracts';
import { analyzeSupersession } from './supersession';
import { contentHash } from './hash';
import { buildRegistryIndexes } from './indexes';
import {
  FASHION_KNOWLEDGE_REGISTRY_SCHEMA_VERSION,
  FASHION_KNOWLEDGE_RULE_SCHEMA_VERSION,
} from '../versioning/release';

export interface RegistryValidationIssue {
  readonly code: string;
  readonly message: string;
}

export interface RegistryValidationResult {
  readonly ok: boolean;
  readonly issues: readonly RegistryValidationIssue[];
}

const MAX_RATIONALE = 2000;
const SCRIPTISH = /<script|javascript:|onerror=|eval\(|Function\(/i;

function issue(code: string, message: string): RegistryValidationIssue {
  return { code, message };
}

export function validateRuleForRegistry(
  rule: FashionKnowledgeRule,
  opts: { allowTestOnly: boolean; productionMode: boolean },
): RegistryValidationIssue[] {
  const issues: RegistryValidationIssue[] = [];
  if (!rule.ruleId) issues.push(issue('missing_rule_id', 'ruleId required'));
  if (rule.schemaVersion !== FASHION_KNOWLEDGE_RULE_SCHEMA_VERSION) {
    issues.push(issue('invalid_rule_schema', 'rule schema version mismatch'));
  }
  if (!rule.ruleVersion) issues.push(issue('missing_rule_version', 'ruleVersion required'));
  if (!isKnowledgeType(rule.knowledgeType)) {
    issues.push(issue('unknown_knowledge_type', String(rule.knowledgeType)));
  }
  if (!isFashionRuleDomain(rule.domain)) {
    issues.push(issue('unknown_domain', String(rule.domain)));
  }
  if (!isSubjectivityLevel(rule.subjectivity)) {
    issues.push(issue('invalid_subjectivity', 'subjectivity invalid'));
  }
  if (!isKnowledgeConfidence(rule.confidence)) {
    issues.push(issue('invalid_confidence', 'confidence invalid'));
  }
  if (!rule.provenance || !isProvenanceSourceType(rule.provenance.sourceType)) {
    issues.push(issue('missing_provenance', 'provenance required'));
  }
  if (
    rule.provenance &&
    !isProvenanceApprovalStatus(rule.provenance.approvalStatus)
  ) {
    issues.push(issue('invalid_provenance_status', 'approvalStatus invalid'));
  }
  if (
    typeof rule.provenance?.sourceConfidence !== 'number' ||
    rule.provenance.sourceConfidence < 0 ||
    rule.provenance.sourceConfidence > 1
  ) {
    issues.push(issue('invalid_source_confidence', 'sourceConfidence 0..1'));
  }
  if (rule.rationale && rule.rationale.length > MAX_RATIONALE) {
    issues.push(issue('oversized_field', 'rationale too long'));
  }
  if (SCRIPTISH.test(rule.rationale ?? '') || SCRIPTISH.test(rule.recommendationPattern.structuredSuggestion ?? '')) {
    issues.push(issue('script_payload', 'script-like content forbidden'));
  }
  // Copyright safety: no long excerpts in rationale
  if ((rule.rationale?.length ?? 0) > 800 && /©|all rights reserved/i.test(rule.rationale)) {
    issues.push(issue('copyright_excerpt', 'Do not store copyrighted excerpts'));
  }

  if (opts.productionMode && rule.testOnly === true) {
    issues.push(issue('test_only_leakage', `TEST_ONLY rule ${rule.ruleId} in production`));
  }
  if (!opts.allowTestOnly && rule.testOnly === true) {
    issues.push(issue('test_only_not_allowed', rule.ruleId));
  }

  // ACTIVE requires valid curated provenance
  if (rule.status === RuleLifecycleStatus.ACTIVE) {
    if (rule.lifecycle !== RuleLifecycleStatus.ACTIVE) {
      issues.push(issue('active_lifecycle_mismatch', rule.ruleId));
    }
    if (
      rule.provenance.approvalStatus !== ProvenanceApprovalStatus.APPROVED &&
      rule.provenance.approvalStatus !== ProvenanceApprovalStatus.ACTIVE
    ) {
      issues.push(
        issue('active_without_approval', `${rule.ruleId} provenance not approved`),
      );
    }
    if (
      rule.provenance.sourceType === ProvenanceSourceType.LLM_GENERAL_KNOWLEDGE ||
      rule.provenance.sourceType === ProvenanceSourceType.UNKNOWN ||
      rule.provenance.approvalStatus === ProvenanceApprovalStatus.UNCURATED
    ) {
      issues.push(
        issue('active_invalid_provenance', `${rule.ruleId} cannot be ACTIVE with LLM/unknown/uncurated`),
      );
    }
    if (
      rule.knowledgeType === KnowledgeType.LLM_GENERAL_KNOWLEDGE
    ) {
      issues.push(issue('active_llm_knowledge', rule.ruleId));
    }
    if (!rule.provenance.reviewer && rule.testOnly !== true) {
      issues.push(
        issue('active_missing_reviewer', `${rule.ruleId} ACTIVE requires reviewer`),
      );
    }
  }

  if (
    rule.knowledgeType === KnowledgeType.TREND &&
    !rule.trendValidity
  ) {
    issues.push(issue('invalid_trend_validity', rule.ruleId));
  }
  if (rule.trendValidity) {
    if (rule.trendValidity.validFrom > rule.trendValidity.validTo) {
      issues.push(issue('invalid_trend_range', rule.ruleId));
    }
  }
  if (
    rule.knowledgeType === KnowledgeType.CULTURAL_CONVENTION &&
    rule.culturalContext.length === 0
  ) {
    issues.push(issue('invalid_cultural_metadata', rule.ruleId));
  }

  for (const c of rule.conditions) {
    if (!isConditionField(c.field)) {
      issues.push(issue('invalid_condition', `field ${c.field}`));
    }
    if (!isConditionOperator(c.operator)) {
      issues.push(issue('invalid_condition', `operator ${c.operator}`));
    }
    const blob = JSON.stringify(c).toLowerCase();
    for (const tok of FORBIDDEN_CONDITION_TOKENS) {
      if (blob.includes(tok.toLowerCase())) {
        issues.push(issue('provider_leakage', tok));
      }
    }
  }

  return issues;
}

export function validateFashionKnowledgeRegistry(
  registry: FashionKnowledgeRegistry,
  opts: { productionMode?: boolean; allowTestOnly?: boolean } = {},
): RegistryValidationResult {
  const productionMode = opts.productionMode === true;
  const allowTestOnly =
    opts.allowTestOnly === true || registry.metadata.allowTestOnly === true;
  const issues: RegistryValidationIssue[] = [];

  if (!registry.registryId) issues.push(issue('missing_registry_id', 'registryId'));
  if (registry.schemaVersion !== FASHION_KNOWLEDGE_REGISTRY_SCHEMA_VERSION) {
    issues.push(issue('invalid_registry_schema', registry.schemaVersion));
  }
  if (!registry.registryVersion) {
    issues.push(issue('missing_registry_version', 'registryVersion'));
  }

  const idSet = new Set<string>();
  const versionKeys = new Set<string>();
  for (const rule of registry.rules) {
    if (idSet.has(rule.ruleId)) {
      issues.push(issue('duplicate_rule_id', rule.ruleId));
    }
    idSet.add(rule.ruleId);
    const vk = `${rule.ruleId}@${rule.ruleVersion}`;
    if (versionKeys.has(vk)) {
      issues.push(issue('duplicate_rule_version', vk));
    }
    versionKeys.add(vk);
    issues.push(
      ...validateRuleForRegistry(rule, { allowTestOnly, productionMode }),
    );
  }

  const provenanceIds = new Set(
    registry.provenanceCatalog.map((p) => p.sourceId),
  );
  for (const rule of registry.rules) {
    if (
      rule.status === RuleLifecycleStatus.ACTIVE &&
      rule.testOnly !== true &&
      !provenanceIds.has(rule.provenance.sourceId) &&
      registry.provenanceCatalog.length > 0
    ) {
      issues.push(
        issue('broken_source_ref', `${rule.ruleId} -> ${rule.provenance.sourceId}`),
      );
    }
  }

  const relationTypes = new Set(Object.values(RuleRelationType));
  for (const rel of registry.relations) {
    if (!relationTypes.has(rel.type)) {
      issues.push(issue('invalid_relation_type', rel.relationId));
    }
    if (!idSet.has(rel.fromRuleId) || !idSet.has(rel.toRuleId)) {
      issues.push(
        issue(
          'broken_conflict_ref',
          `${rel.relationId}: ${rel.fromRuleId}->${rel.toRuleId}`,
        ),
      );
    }
  }

  const superAnalysis = analyzeSupersession(registry.relations);
  if (!superAnalysis.valid) {
    issues.push(
      issue(
        'circular_supersession',
        superAnalysis.cycles.join('; ') || 'cycle detected',
      ),
    );
  }

  // Snapshot hash integrity
  const recomputedIndexes = buildRegistryIndexes(registry.rules);
  const expectedHash = contentHash({
    registryVersion: registry.registryVersion,
    rules: registry.rules.map((r) => ({
      id: r.ruleId,
      v: r.ruleVersion,
      s: r.status,
      d: r.domain,
    })),
    relations: registry.relations,
    provenance: registry.provenanceCatalog.map((p) => p.sourceId).sort(),
    indexes: recomputedIndexes,
  });
  if (registry.snapshotHash && registry.snapshotHash !== expectedHash) {
    // Allow empty registry with explicit empty hash computation from builder
    if (registry.rules.length > 0 || registry.snapshotHash !== expectedHash) {
      issues.push(
        issue(
          'registry_hash_mismatch',
          'snapshotHash does not match content',
        ),
      );
    }
  }

  return { ok: issues.length === 0, issues };
}
