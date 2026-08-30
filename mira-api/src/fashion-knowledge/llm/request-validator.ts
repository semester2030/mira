/**
 * FK-3 — Request contract validator.
 */
import type { FashionLlmKnowledgeRequest } from './request-contract';
import { FASHION_LLM_REQUEST_VERSION } from '../versioning/release';

export function validateFashionLlmRequest(
  request: FashionLlmKnowledgeRequest,
): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!request.requestId) issues.push('missing_request_id');
  if (!request.traceId) issues.push('missing_trace_id');
  if (!request.clockNowIso) issues.push('missing_clock');
  if (request.schemaVersion !== FASHION_LLM_REQUEST_VERSION) {
    issues.push('invalid_schema_version');
  }
  if (!request.garmentFacts?.length) issues.push('missing_garment_facts');
  if (!request.evidenceRefs?.length) issues.push('missing_evidence_refs');
  if (!request.locale) issues.push('missing_locale');

  const blob = JSON.stringify(request).toLowerCase();
  for (const tok of ['fashn', 'openai', 'api_key', 'decision_ledger', 'raw_provider']) {
    if (blob.includes(tok)) issues.push(`provider_leakage:${tok}`);
  }
  return { ok: issues.length === 0, issues };
}
