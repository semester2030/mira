/**
 * Fashion Knowledge Layer — production public barrel (FK-12 hardened).
 * Does NOT export: test fixtures, mock LLM provider, registry mutation helpers.
 * Tests import from internal/test paths directly.
 */
export * from './versioning/release';
export * from './contracts/knowledge-types';
export * from './contracts/subjectivity';
export * from './contracts/provenance';
export * from './contracts/rule-domains';
export * from './contracts/conditions';
export * from './contracts/applicability';
export * from './contracts/advice-types';
export * from './contracts/confidence';
export * from './contracts/conflicts';
export * from './contracts/claim-strength';
export * from './contracts/alternatives';
export * from './contracts/claim-lock';
export * from './knowledge/fashion-knowledge-rule';
export * from './advice/advice-candidate';
export * from './advice/llm-candidate-policy';
export * from './claim-lock/claim-lock-runtime';
export * from './runtime/evaluation-context';
export * from './validation/tone-safety';
export * from './validation/validators';
export * from './conflict/curated-precedence';
export * from './ports/extension-ports';
// FK-12: fixtures intentionally NOT re-exported from public barrel
export * from './llm/feature-flag';
export * from './llm/config';
export * from './llm/request-contract';
export * from './llm/request-validator';
export * from './llm/context-projection';
export * from './llm/prompt-policy';
export * from './llm/prompt-builder';
export * from './llm/provider-port';
export * from './llm/draft-validator';
export * from './llm/draft-mapper';
export * from './llm/confidence-cap';
export * from './llm/knowledge-type-policy';
export * from './llm/output-sanitization';
export * from './llm/retry-policy';
export * from './llm/runtime';
export * from './llm/cost-telemetry';
export * from './llm/caching-decision';
export * from './llm/evaluation-result';
export * from './llm/orchestrator';
// mock-provider NOT exported from public barrel (FK-12)
export * from './registry/contracts';
export * from './registry/hash';
export * from './registry/condition-evaluator';
export * from './registry/indexes';
export * from './registry/supersession';
export * from './registry/validation';
export * from './registry/snapshot';
export * from './registry/audit';
export * from './registry/lookup';
export * from './registry/feature-flag';
export * from './registry/cache';
export * from './registry/loader';
export * from './registry/llm-write-guard';
export * from './registry/claim-lock-compat';
export * from './registry/performance';
// storage/release/fixtures write surfaces NOT exported from public barrel
export * from './curated';
export * from './approval';
export * from './accessories';
export * from './form-silhouette';
export * from './cultural-context';
export * from './telemetry';
export * from './advisor-integration';
