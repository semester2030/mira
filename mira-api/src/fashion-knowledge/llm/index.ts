/** FK-3 LLM hybrid adapter surface (production-safe exports) */
export * from './feature-flag';
export * from './config';
export * from './request-contract';
export * from './request-validator';
export * from './context-projection';
export * from './prompt-policy';
export * from './prompt-builder';
export * from './provider-port';
export * from './draft-validator';
export * from './draft-mapper';
export * from './confidence-cap';
export * from './knowledge-type-policy';
export * from './output-sanitization';
export * from './retry-policy';
export * from './runtime';
export * from './cost-telemetry';
export * from './caching-decision';
export * from './evaluation-result';
export * from './orchestrator';
export {
  OpenAiFashionKnowledgeLlmProvider,
  resolveProductionFashionLlmConfig,
  parseOpenAiFashionDraftJson,
} from './providers';
// MockFashionKnowledgeLlmProvider: import from './mock-provider' in tests only (FK-12)

